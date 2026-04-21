import React, { useState } from 'react';
import Home from './components/Home';
import Workspace from './components/Workspace';

function App() {
  const [roomId, setRoomId] = useState(null);

  const handleJoinRoom = (id) => {
    setRoomId(id);
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
  };

  return (
    <div className="app-container">
      {!roomId ? (
        <Home onJoinRoom={handleJoinRoom} />
      ) : (
        <Workspace roomId={roomId} onLeave={handleLeaveRoom} />
      )}
    </div>
  );
}

export default App;
