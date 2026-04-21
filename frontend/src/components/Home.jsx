import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sparkles, ArrowRight } from 'lucide-react';

const Home = ({ onJoinRoom }) => {
  const [joinId, setJoinId] = useState('');

  const handleGenerateId = () => {
    const newId = uuidv4().slice(0, 8); // use short UUID for simplicity
    onJoinRoom(newId);
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (joinId.trim()) {
      onJoinRoom(joinId.trim());
    }
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="home-title">Weave Workspace</h1>
        <p className="home-subtitle">Collaborate in real-time on an infinite canvas</p>

        <div className="input-group">
          <button onClick={handleGenerateId} className="primary">
            <Sparkles size={20} />
            Generate New Room
          </button>

          <div className="divider">or join existing</div>

          <form onSubmit={handleJoinSubmit} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <input 
                type="text" 
                placeholder="Enter Room ID" 
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
              />
              <button type="submit" className="secondary" style={{ width: 'auto', padding: '0 1rem' }} disabled={!joinId.trim()}>
                <ArrowRight size={20} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Home;
