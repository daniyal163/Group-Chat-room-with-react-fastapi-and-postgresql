import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import RoomSocketio from './RoomSocketio';

function App() {

return(

  <BrowserRouter> 
  <nav>
  <Link to = "/">ChatRoom</Link>  {""}
</nav>
<Routes>
  <Route path = "/" element = {<RoomSocketio/>}></Route>
</Routes>

  </BrowserRouter>
)


}

export default App;














//   const [messages, setMessages] = useState([]);
//   const [inputValue, setInputValue] = useState('');
//   const ws = useRef(null);

//   useEffect(() => {
// ws.current = new WebSocket('ws://127.0.0.1:8000/ws');
//     ws.current.onopen = () => alert('Connected to FastAPI WebSocket');

//     ws.current.onmessage = (event) => {
//       setMessages((prev) => [...prev, event.data]);
//     };

//     ws.current.onclose = () => console.log('WebSocket disconnected');

//     return () => {
//     if (ws.current) {
//       if (ws.current.readyState === WebSocket.CONNECTING || ws.current.readyState === WebSocket.OPEN) {
//       }
//     }
//   };
// }, []);


//   const handlesenddata = ()=>{
//     if(ws.current && ws.current.readyState === WebSocket.OPEN){
//       if(inputValue!==''){
//       console.log("Sending data to the backedn",inputValue)
//       ws.current.send(inputValue)
//       setInputValue('')
//     }
//     } else
//     {
//       alert("Websocket is not connected")
//     }
//   }
//   return (
    
//     <div style={{ padding: '20px' }}>
//       <div style={{ padding: '20px', fontFamily: 'sans-serif' }}></div>
//       <h2>FastAPI + React WebSockets</h2>
//       <input
//         type="text"
//         value={inputValue}
//         onChange={(e) => setInputValue(e.target.value)}
//         placeholder="Type something to send..."
//         style={{ padding: '8px', marginRight: '8px' }}
//       />
//       <br/>
//       <button className="border rounded-md border-gray-300 p-4 w-64"    onClick={handlesenddata}>Send</button>

// <h3>Data History (Received from Backend):</h3>     
//  <div style={{ border: '1px solid #ccc', padding: '10px' }}>
//         {messages.length === 0 ? <p>No data received yet.</p> : null}
//         <ul>
//           {messages.map((msg, index) => (
//             <li key={index} style={{ margin: '5px 0' }}>{msg}</li>
//           ))}
//         </ul>
//       </div>
//     </div>
//   );
