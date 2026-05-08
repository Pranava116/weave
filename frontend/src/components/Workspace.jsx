import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { MousePointer2, LogOut, Square, Send } from 'lucide-react';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

const Workspace = ({ roomId, onLeave }) => {
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [cursors, setCursors] = useState({});
  const [boxes, setBoxes] = useState({});
  const [inputs, setInputs] = useState({});
  const [apiKeys, setApiKeys] = useState({});
  const [connections, setConnections] = useState([]);
  const [drawingConnection, setDrawingConnection] = useState(null);
  const isDrawing = useRef(false);
  const draggingBox = useRef(null);
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

    newSocket.on('init-boxes', (initialBoxes) => {
      if (initialBoxes) setBoxes(initialBoxes);
    });

    newSocket.on('box-added', (box) => {
      setBoxes(prev => ({ ...prev, [box.id]: box }));
    });

    newSocket.on('box-moved', ({ boxId, x, y }) => {
      setBoxes(prev => {
        if (!prev[boxId]) return prev;
        return {
          ...prev,
          [boxId]: { ...prev[boxId], x, y }
        };
      });
    });

    newSocket.on('box-message-added', ({ boxId, message }) => {
      setBoxes(prev => {
        if (!prev[boxId]) return prev;
        const box = prev[boxId];
        const messages = box.messages ? [...box.messages] : [];
        messages.push(message);
        return {
          ...prev,
          [boxId]: { ...box, messages }
        };
      });
    });

    newSocket.on('init-connections', (initialConnections) => {
      if (initialConnections) setConnections(initialConnections);
    });

    newSocket.on('connection-added', (connection) => {
      setConnections(prev => [...prev, connection]);
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
        // Keep image data, resiaze canvas
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

  const handleAddBox = () => {
    if (!socket) return;
    const newBox = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * 100,
      y: Math.random() * 100,
      width: 320,
      height: 450,
      color: '#4f46e5',
      messages: []
    };

    setBoxes(prev => ({ ...prev, [newBox.id]: newBox }));
    socket.emit('add-box', { roomId, box: newBox });
  };

  const handleMouseMove = (e) => {
    if (!socket || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Throttle emit slightly if needed, but for simple tests sending every move is fine
    socket.emit('mouse-move', { roomId, x, y });

    if (drawingConnection) {
      setDrawingConnection(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
    }

    if (draggingBox.current) {
      const { id, offsetX, offsetY } = draggingBox.current;
      const newX = x - offsetX;
      const newY = y - offsetY;

      setBoxes(prev => ({
        ...prev,
        [id]: { ...prev[id], x: newX, y: newY }
      }));

      socket.emit('box-move', { roomId, boxId: id, x: newX, y: newY });
      return;
    }

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

  const handleMouseUp = (e) => {
    isDrawing.current = false;
    draggingBox.current = null;

    if (drawingConnection && e && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setBoxes(prevBoxes => {
        const targetBox = Object.values(prevBoxes).find(b =>
          b.id !== drawingConnection.fromBoxId &&
          x >= b.x && x <= b.x + b.width &&
          y >= b.y && y <= b.y + b.height
        );

        if (targetBox) {
          const newConn = {
            id: Math.random().toString(36).substr(2, 9),
            fromBoxId: drawingConnection.fromBoxId,
            toBoxId: targetBox.id
          };
          setConnections(prev => [...prev, newConn]);
          socket.emit('add-connection', { roomId, connection: newConn });
        }
        return prevBoxes;
      });
    }
    setDrawingConnection(null);
  };

  const handleSendMessage = (e, boxId) => {
    e.preventDefault();
    const content = inputs[boxId]?.trim();
    if (!content || !socket) return;

    const message = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'user',
      content
    };

    setBoxes(prev => {
      const box = prev[boxId];
      const messages = box.messages ? [...box.messages] : [];
      messages.push(message);
      return { ...prev, [boxId]: { ...box, messages } };
    });

    setInputs(prev => ({ ...prev, [boxId]: '' }));
    const apiKey = apiKeys[boxId];
    socket.emit('box-new-message', { roomId, boxId, message, apiKey });
  };

  const handleInputChange = (boxId, val) => {
    setInputs(prev => ({ ...prev, [boxId]: val }));
  };

  const handleBoxPointerDown = (e, boxId) => {
    e.stopPropagation();
    const box = boxes[boxId];
    if (!box || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    draggingBox.current = {
      id: boxId,
      offsetX: x - box.x,
      offsetY: y - box.y
    };
  };

  return (
    <div className="workspace-container">
      <header className="workspace-header">
        <div className="workspace-id">
          Room: <strong>{roomId}</strong>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="secondary" onClick={handleAddBox} style={{ width: 'auto', padding: '0.5rem 1rem' }}>
            <Square size={16} />
            Add Box
          </button>
          <button className="leave-btn" onClick={onLeave}>
            <LogOut size={16} />
            Leave
          </button>
        </div>
      </header>

      <div className="canvas-area"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
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

        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
        >
          {connections.map(conn => {
            const fromBox = boxes[conn.fromBoxId];
            const toBox = boxes[conn.toBoxId];
            if (!fromBox || !toBox) return null;

            const startX = fromBox.x + fromBox.width;
            const startY = fromBox.y + fromBox.height / 2;
            const endX = toBox.x;
            const endY = toBox.y + toBox.height / 2;

            return (
              <line
                key={conn.id}
                x1={startX} y1={startY} x2={endX} y2={endY}
                stroke="#94a3b8" strokeWidth="3" markerEnd="url(#arrowhead)"
              />
            );
          })}

          {drawingConnection && boxes[drawingConnection.fromBoxId] && (
            <line
              x1={boxes[drawingConnection.fromBoxId].x + boxes[drawingConnection.fromBoxId].width}
              y1={boxes[drawingConnection.fromBoxId].y + boxes[drawingConnection.fromBoxId].height / 2}
              x2={drawingConnection.currentX}
              y2={drawingConnection.currentY}
              stroke="#94a3b8" strokeWidth="3" strokeDasharray="5,5" markerEnd="url(#arrowhead)"
            />
          )}

          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7"
              refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>

        {/* Render connection points outside the boxes */}
        {Object.values(boxes).map((box) => (
          <div
            key={`conn-${box.id}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = canvasRef.current.getBoundingClientRect();
              setDrawingConnection({
                fromBoxId: box.id,
                currentX: e.clientX - rect.left,
                currentY: e.clientY - rect.top
              });
            }}
            style={{
              position: 'absolute',
              left: box.x + box.width - 6,
              top: box.y + box.height / 2 - 6,
              width: '12px',
              height: '12px',
              backgroundColor: box.color,
              borderRadius: '50%',
              cursor: 'crosshair',
              zIndex: 30,
              border: '2px solid white',
              boxShadow: '0 0 4px rgba(0,0,0,0.3)'
            }}
          />
        ))}

        {Object.values(boxes).map((box) => (
          <div
            key={box.id}
            style={{
              position: 'absolute',
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              borderRadius: '12px',
              border: `1px solid ${box.color}`,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--canvas-bg)'
            }}
          >
            <div
              className="box-drag-handle"
              onPointerDown={(e) => handleBoxPointerDown(e, box.id)}
              style={{ backgroundColor: box.color }}
            >
              <div className="box-drag-handle-indicator" />
            </div>
            <div className="chat-container">
              <div className="chat-messages">
                {(box.messages || []).map((msg) => (
                  <div key={msg.id} className={`chat-message ${msg.role}`}>
                    {msg.content}
                  </div>
                ))}
              </div>
              {!apiKeys[box.id] ? (
                <form className="chat-input-area" onSubmit={(e) => {
                  e.preventDefault();
                  if (inputs[box.id]?.trim()) {
                    setApiKeys(prev => ({ ...prev, [box.id]: inputs[box.id].trim() }));
                    setInputs(prev => ({ ...prev, [box.id]: '' }));
                  }
                }}>
                  <input
                    type="password"
                    placeholder="Enter OpenAI API Key..."
                    value={inputs[box.id] || ''}
                    onChange={(e) => handleInputChange(box.id, e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  <button type="submit" style={{ backgroundColor: box.color, padding: '0.5rem 0.75rem' }}>
                    <Send size={16} />
                  </button>
                </form>
              ) : (
                <form className="chat-input-area" onSubmit={(e) => handleSendMessage(e, box.id)}>
                  <input
                    type="text"
                    placeholder="Message ChatGPT..."
                    value={inputs[box.id] || ''}
                    onChange={(e) => handleInputChange(box.id, e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  <button type="submit" style={{ backgroundColor: box.color, padding: '0.5rem 0.75rem' }}>
                    <Send size={16} />
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Workspace;
