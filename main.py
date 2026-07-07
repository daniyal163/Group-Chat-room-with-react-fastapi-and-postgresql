from fastapi.concurrency import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import socketio
from sqlalchemy import select

from db import engine, AsyncSessionLocal
import models
from auth import hash_password, verify_password


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    print("DB ready.")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthRequest(BaseModel):
    username: str
    password: str


@app.post("/register")
async def register(data: AuthRequest):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.User).where(models.User.username == data.username))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")
        user = models.User(username=data.username, password_hash=hash_password(data.password))
        session.add(user)
        await session.commit()
        return {"message": "Registered successfully", "username": data.username}


@app.post("/login")
async def login(data: AuthRequest):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.User).where(models.User.username == data.username))
        user = result.scalar_one_or_none()
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        return {"message": "Login successful", "username": user.username, "user_id": user.id}


@app.get("/rooms")
async def list_rooms():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.Room.name).order_by(models.Room.name))
        return {"rooms": [r[0] for r in result.all()]}

#  Socket.IO 

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=[])
socket_app = socketio.ASGIApp(sio)
app.mount("/socket.io", socket_app)

user_rooms = {}       # sid -> room_name
sid_username = {}     # sid -> username
active_room = {}      # room_name -> [usernames currently connected] (live presence only)


async def authenticate(username, password):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.User).where(models.User.username == username))
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            return None
        return user


async def get_or_create_room(session, room_name):
    result = await session.execute(select(models.Room).where(models.Room.name == room_name))
    room = result.scalar_one_or_none()
    if not room:
        room = models.Room(name=room_name)
        session.add(room)
        await session.flush()
    return room


@sio.on('join_room')
async def join(sid, data):
    room = data.get('room')
    username = data.get('username')
    password = data.get('password')

    if not room or not username or not password:
        await sio.emit('join_error', {"message": "Missing username, password, or room."}, to=sid)
        return

    user = await authenticate(username, password)
    if not user:
        await sio.emit('join_error', {"message": "Invalid username or password."}, to=sid)
        return

    for other_sid, other_username in sid_username.items():
        if other_username == username and other_sid != sid:
            await sio.emit('join_error', {"message": f"'{username}' is already connected elsewhere."}, to=sid)
            return

    sid_username[sid] = username
    user_rooms[sid] = room
    active_room.setdefault(room, [])
    if username not in active_room[room]:
        active_room[room].append(username)
    await sio.enter_room(sid, room)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            room_obj = await get_or_create_room(session, room)
            membership_check = await session.execute(
                select(models.UserRoom).where(
                    models.UserRoom.user_id == user.id, models.UserRoom.room_id == room_obj.id
                )
            )
            if not membership_check.scalar_one_or_none():
                session.add(models.UserRoom(user_id=user.id, room_id=room_obj.id))
            room_id = room_obj.id

        result = await session.execute(
            select(models.Message, models.User.username, models.User.id)
            .join(models.User, models.Message.user_id == models.User.id)
            .where(models.Message.room_id == room_id)
            .order_by(models.Message.id)
        )
        history = [
            {"id": m.id, "user_id": uid, "sender": sender, "text": m.text, "room": room}
            for m, sender, uid in result.all()
        ]

    await sio.emit('chat_history', history, to=sid)
    await sio.emit('room_users', active_room[room], room=room)
    await sio.emit('receive_message', {"sender": "System", "text": f"{username} has joined the room!"}, room=room)


@sio.on("send_message")
async def handle_message(sid, data):
    room = user_rooms.get(sid)
    username = sid_username.get(sid)
    if not room or not username:
        return
    text = data.get("text")

    async with AsyncSessionLocal() as session:
        async with session.begin():
            result = await session.execute(select(models.User).where(models.User.username == username))
            user = result.scalar_one()
            room_obj = await get_or_create_room(session, room)
            msg = models.Message(text=text, user_id=user.id, room_id=room_obj.id)
            session.add(msg)
            await session.flush()
            msg_id, user_id = msg.id, user.id

    await sio.emit("receive_message",
                    {"id": msg_id, "user_id": user_id, "sender": username, "text": text, "room": room},
                    room=room)


@sio.on("get_available_rooms")
async def handle_get_rooms(sid):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.Room.name).order_by(models.Room.name))
        await sio.emit("available_rooms_list", [r[0] for r in result.all()], to=sid)


@sio.on("leave_room")
async def handle_leave(sid, data):
    username = sid_username.get(sid)
    room = user_rooms.get(sid)
    if room and username:
        if room in active_room and username in active_room[room]:
            active_room[room].remove(username)
        await sio.leave_room(sid, room)
        user_rooms.pop(sid, None)
        sid_username.pop(sid, None)
        await sio.emit("receive_message", {"sender": "System", "text": f"{username} left the chat room."}, room=room)
        await sio.emit('room_users', active_room.get(room, []), room=room)


@sio.event
async def disconnect(sid):
    username = sid_username.get(sid)
    room = user_rooms.get(sid)
    if room and username:
        if room in active_room and username in active_room[room]:
            active_room[room].remove(username)
        await sio.emit("receive_message", {"sender": "System", "text": f"{username} disconnected."}, room=room)
        await sio.emit('room_users', active_room.get(room, []), room=room)
    user_rooms.pop(sid, None)
    sid_username.pop(sid, None)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)