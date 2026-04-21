import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { MousePointer2, LogOut } from 'lucide-react';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

const Workspace = ({ roomId, onLeave }) => {
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [cursors, setCursors] = useState({});
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Connect to backend
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId });
    });

    newSocket.on('mouse-update', ({ userId, x, y }) => {
      setCursors(prev => ({
        ...prev,
        [userId]: { x, y }
      }));
    });

    newSocket.on('user-left', ({ userId }) => {
      setCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    });

    newSocket.on('draw-update', (drawData) => {
      drawOnCanvas(drawData.x0, drawData.y0, drawData.x1, drawData.y1, false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    // Setup canvas size
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      
      const handleResize = () => {
        // Keep image data, resize canvas
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        ctx.putImageData(imgData, 0, 0);
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const getCursorColor = (userId) => {
    // Simple hash to consistently assign a color
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  };

  const drawOnCanvas = (x0, y0, x1, y1, emit = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.closePath();

    if (!emit || !socket) return;
    
    socket.emit('draw', {
      roomId,
      drawData: { x0, y0, x1, y1 }
    });
  };

  const handleMouseMove = (e) => {
    if (!socket || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Throttle emit slightly if needed, but for simple tests sending every move is fine
    socket.emit('mouse-move', { roomId, x, y });

    if (isDrawing.current) {
      drawOnCanvas(lastPos.current.x, lastPos.current.y, x, y, true);
    }
    
    lastPos.current = { x, y };
  };

  const handleMouseDown = (e) => {
    isDrawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    lastPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  return (
    <div className="workspace-container">
      <header className="workspace-header">
        <div className="workspace-id">
          Room: <strong>{roomId}</strong>
        </div>
        <button className="leave-btn" onClick={onLeave}>
          <LogOut size={16} />
          Leave
        </button>
      </header>
      
      <div className="canvas-area">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        
        {Object.entries(cursors).map(([userId, pos]) => (
          <div 
            key={userId} 
            className="cursor-overlay"
            style={{ 
              transform: `translate(${pos.x}px, ${pos.y}px)`,
            }}
          >
            <MousePointer2 
              size={24} 
              className="cursor-icon" 
              style={{ fill: getCursorColor(userId) }} 
            />
            <div 
              className="cursor-name"
              style={{ backgroundColor: getCursorColor(userId) }}
            >
              User {userId.substring(0, 4)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Workspace;
