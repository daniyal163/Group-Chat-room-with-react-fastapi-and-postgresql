import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const API_BASE = 'http://0.0.0.0:8000';

const socket = io(API_BASE, {
  path: '/socket.io/',
  autoConnect: false
});

export default function App() {
  // auth state
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // room state
  const [room, setRoom] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState('');

  const [messageText, setMessageText] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);

  useEffect(() => {
    socket.connect();

    function onMessageReceived(data) {
      setChatHistory((prev) => [...prev, data]);
    }
    function onChatHistory(history) {
      setChatHistory(history);
    }
    function onAvailableRoomsReceived(roomsList) {
      setAvailableRooms(roomsList);
    }
    function onRoomUsers(users) {
      setRoomUsers(users);
    }
    function onJoinError(err) {
      setJoinError(err.message);
      setIsJoined(false);
    }

    socket.on('receive_message', onMessageReceived);
    socket.on('chat_history', onChatHistory);
    socket.on('available_rooms_list', onAvailableRoomsReceived);
    socket.on('room_users', onRoomUsers);
    socket.on('join_error', onJoinError);

    return () => {
      socket.off('receive_message', onMessageReceived);
      socket.off('chat_history', onChatHistory);
      socket.off('available_rooms_list', onAvailableRoomsReceived);
      socket.off('room_users', onRoomUsers);
      socket.off('join_error', onJoinError);
    };
  }, []);

  // ---------- Auth handlers ----------

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/login' : '/register';
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || 'Something went wrong');
        return;
      }
      if (authMode === 'register') {
        setAuthError('');
        setAuthMode('login');
        alert('Registered! Now log in.');
        return;
      }
      // login success
      setIsAuthenticated(true);
      socket.emit('get_available_rooms');
    } catch (err) {
      setAuthError('Could not reach server.');
    }
  };

  // ---------- Room handlers ----------

  const handleJoinRoom = (e, targetRoom) => {
    if (e) e.preventDefault();
    const roomToJoin = targetRoom || room;
    if (!roomToJoin) return;
    setJoinError('');
    socket.emit('join_room', { username: authUsername, password: authPassword, room: roomToJoin });
    setRoom(roomToJoin);
    setIsJoined(true);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      socket.emit('send_message', { text: messageText });
      setMessageText('');
    }
  };

  const handleLeaveRoom = () => {
    socket.emit('leave_room', {});
    setIsJoined(false);
    setChatHistory([]);
    setRoomUsers([]);
    setRoom('');
    socket.emit('get_available_rooms');
  };

  const handleCreateRoom = async () => {
    const newRoomName = prompt('New room name:');
    if (newRoomName && newRoomName.trim()) {
      handleJoinRoom(null, newRoomName.trim());
    }
  };

  // ---------- SCREEN 0: Login / Register ----------
  if (!isAuthenticated) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '360px', margin: '0 auto' }}>
        <h2>{authMode === 'login' ? 'Log In' : 'Register'}</h2>
        {authError && <p style={{ color: 'red', fontSize: '14px' }}>{authError}</p>}
        <form onSubmit={handleAuthSubmit}>
          <input
            type="text" placeholder="Username" required value={authUsername}
            onChange={(e) => setAuthUsername(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px', boxSizing: 'border-box' }}
          />
          <input
            type="password" placeholder="Password" required value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ padding: '8px 16px', width: '100%', cursor: 'pointer' }}>
            {authMode === 'login' ? 'Log In' : 'Register'}
          </button>
        </form>
        <p style={{ fontSize: '13px', marginTop: '12px' }}>
          {authMode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
            style={{ background: 'none', border: 'none', color: '#0070f3', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
          >
            {authMode === 'login' ? 'Register' : 'Log In'}
          </button>
        </p>
      </div>
    );
  }

  // ---------- SCREEN 1: Room selection ----------
  if (!isJoined) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '400px' }}>
        <p>Logged in as: <strong>{authUsername}</strong></p>
        {joinError && <p style={{ color: 'red', fontSize: '14px' }}>{joinError}</p>}

        <h2>Join a Room</h2>
        <form onSubmit={(e) => handleJoinRoom(e)}>
          <input
            type="text" placeholder="Room Name (e.g., Lounge)" required value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer', width: '100%' }}>Enter Chat</button>
        </form>

        <h3 style={{ marginTop: '20px' }}>All Rooms</h3>
        {availableRooms.length === 0 ? (
          <p style={{ color: 'gray', fontSize: '14px' }}>No rooms yet — create one above.</p>
        ) : (
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {availableRooms.map((roomName, idx) => (
              <li key={idx} style={{ marginBottom: '6px' }}>
                <button
                  onClick={() => handleJoinRoom(null, roomName)}
                  style={{ background: 'none', border: 'none', color: '#0070f3', textDecoration: 'underline', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  {roomName}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => socket.emit('get_available_rooms')}
          style={{ marginTop: '15px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
      </div>
    );
  }

  // ---------- SCREEN 2: Active chat ----------
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Room: <span style={{ color: '#0070f3' }}>{room}</span></h2>
        <button onClick={handleLeaveRoom} style={{ padding: '6px 12px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Leave Room
        </button>
      </div>
      <p>Logged in as: <strong>{authUsername}</strong></p>
      <p style={{ fontSize: '13px', color: '#555' }}>
        Users currently online in room: {roomUsers.join(', ') || '—'}
      </p>

      <div style={{ border: '1px solid #ccc', height: '300px', overflowY: 'scroll', padding: '10px', marginBottom: '10px', backgroundColor: '#f9f9f9' }}>
        {chatHistory.map((msg, index) => (
          <div key={msg.id ?? index} style={{ marginBottom: '8px' }}>
            <span style={{ color: msg.sender === 'System' ? 'gray' : '#333', fontWeight: 'bold' }}>
              {msg.sender}:
            </span>
            <span> {msg.text}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage} style={{ display: 'flex', marginBottom: '20px' }}>
        <input
          type="text" placeholder="Type a message..." value={messageText}
          onChange={(e) => setMessageText(e.target.value)} style={{ flexGrow: 1, padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 16px', marginLeft: '5px', cursor: 'pointer' }}>Send</button>
      </form>

      <h3>Message Log (Table View)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
            <th style={{ padding: '4px' }}>Username</th>
            <th style={{ padding: '4px' }}>User ID</th>
            <th style={{ padding: '4px' }}>Message</th>
            <th style={{ padding: '4px' }}>Room</th>
          </tr>
        </thead>
        <tbody>
          {chatHistory
            .filter((m) => m.sender !== 'System')
            .map((msg, idx) => (
              <tr key={msg.id ?? idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '4px' }}>{msg.sender}</td>
                <td style={{ padding: '4px' }}>{msg.user_id ?? '—'}</td>
                <td style={{ padding: '4px' }}>{msg.text}</td>
                <td style={{ padding: '4px' }}>{msg.room ?? room}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}