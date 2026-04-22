const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Keep track of room states if needed, but for now we just rely on rooms
const rooms = new Set();
const roomData = new Map(); // roomId -> { boxes: {} }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle joining a room
  socket.on('join-room', ({ roomId }) => {
    socket.join(roomId);
    rooms.add(roomId);
    
    if (!roomData.has(roomId)) {
      roomData.set(roomId, { boxes: {} });
    }

    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Tell the user they successfully joined
    socket.emit('room-joined', { roomId, userId: socket.id });
    
    // Send existing boxes to the user
    socket.emit('init-boxes', roomData.get(roomId).boxes);
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', { userId: socket.id });
  });

  // Handle mouse movements
  socket.on('mouse-move', ({ roomId, x, y }) => {
    // Broadcast to everyone else in the room
    socket.to(roomId).emit('mouse-update', { userId: socket.id, x, y });
  });

  // Handle drawing events
  socket.on('draw', ({ roomId, drawData }) => {
    socket.to(roomId).emit('draw-update', drawData);
  });

  // Handle box events
  socket.on('add-box', ({ roomId, box }) => {
    if (roomData.has(roomId)) {
      roomData.get(roomId).boxes[box.id] = box;
    }
    socket.to(roomId).emit('box-added', box);
  });

  socket.on('box-move', ({ roomId, boxId, x, y }) => {
    if (roomData.has(roomId) && roomData.get(roomId).boxes[boxId]) {
      roomData.get(roomId).boxes[boxId].x = x;
      roomData.get(roomId).boxes[boxId].y = y;
    }
    socket.to(roomId).emit('box-moved', { boxId, x, y });
  });

  // Handle disconnection
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('user-left', { userId: socket.id });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
