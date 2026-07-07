import React, { useEffect, useState, useRef } from "react";

function ChatRoom() {
    const [myId, setMyId] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    
    const [messages, setMessages] = useState([]);
    const [inputVal, setInputVal] = useState("");
    const [targetUser, setTargetUser] = useState("all");
    const [onlineUsers, setOnlineUsers] = useState([]);
    
    const ws = useRef(null);

    useEffect(() => {
        

        ws.current = new WebSocket(`ws://127.0.0.1:8000/ws/${myId}`);

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === "users_update") {
                setOnlineUsers(data.users.filter(user => user !== myId));
            } else {
                setMessages((prev) => [...prev, data]);
            }
        };

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [isConnected, myId]);

    const sendMessage = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN && inputVal.trim() !== "") {
            const payload = {
                target: targetUser,
                text: inputVal
            };
            ws.current.send(JSON.stringify(payload));
            setInputVal("");
        }
    };

    if (!isConnected) {
        return (
            <div style={{ padding: "20px" }}>
                <h2>Enter your User ID to log in:</h2>
                <input 
                    type="text" 
                    placeholder="e.g., alice, user123" 
                    value={myId} 
                    onChange={(e) => setMyId(e.target.value.trim())} 
                />
                <button onClick={() => myId && setIsConnected(true)}>Connect</button>
            </div>
        );
    }

    return (
        <div style={{ padding: "20px" }}>
            <h2>Logged in as: <span style={{ color: "green" }}>{myId}</span></h2>

            {/* Dropdown to pick recipient */}
            <div style={{ margin: "10px 0" }}>
                <label>Send to: </label>
                <select value={targetUser} onChange={(e) => setTargetUser(e.target.value)}>
                    <option value="all">Everyone (Broadcast)</option>
                    {onlineUsers.map(user => (
                        <option key={user} value={user}>{user}</option>
                    ))}
                </select>
            </div>

            <input 
                type="text" 
                value={inputVal} 
                onChange={(e) => setInputVal(e.target.value)} 
                placeholder={targetUser === 'all' ? "Message everyone..." : `Secret message to ${targetUser}...`}
            />
            <button className="transition-colors" onClick={sendMessage}>Send</button>

            {/* Logs display */}
            <h3>Conversation Logs:</h3>
            <ul style={{ background: "#f0f0f0", padding: "15px", borderRadius: "5px", listStyleType: "none" }}>
                {messages.map((msg, index) => (
                    <li key={index} style={{ marginBottom: "5px" }}>
                        <strong>{msg.sender}</strong> 
                        <span style={{ color: msg.target !== "all" ? "purple" : "blue", fontSize: "12px" }}>
                            {msg.target === "all" ? " (to all): " : ` (privately to ${msg.target}): `}
                        </span>
                        {msg.text}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ChatRoom;