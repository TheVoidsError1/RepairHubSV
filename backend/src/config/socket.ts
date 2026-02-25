import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getAllowedOrigins } from '../utils/cors.js';

let io: SocketIOServer | null = null;

export const initializeSocket = (httpServer: HTTPServer) => {
  const allowedOrigins = getAllowedOrigins(process.env.FRONTEND_URL);
  
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });

    // Join room for specific user/role
    socket.on('join-room', (room: string) => {
      socket.join(room);
      console.log(`👥 Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave-room', (room: string) => {
      socket.leave(room);
      console.log(`👋 Socket ${socket.id} left room: ${room}`);
    });
  });

  console.log('🔌 Socket.IO initialized');
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};

// Helper functions to emit events
export const emitRepairUpdate = (repair: any) => {
  if (io) {
    io.emit('repair:updated', repair);
    console.log(`📡 Emitted repair:updated for ${repair.repairNumber || repair.id}`);
  }
};

export const emitRepairCreated = (repair: any) => {
  if (io) {
    io.emit('repair:created', repair);
    console.log(`📡 Emitted repair:created for ${repair.repairNumber || repair.id}`);
  }
};

export const emitRepairDeleted = (repairId: string) => {
  if (io) {
    io.emit('repair:deleted', { id: repairId });
    console.log(`📡 Emitted repair:deleted for ${repairId}`);
  }
};

export const emitWarrantyUpdate = (warranty: any) => {
  if (io) {
    io.emit('warranty:updated', warranty);
    console.log(`📡 Emitted warranty:updated for ${warranty.claimNumber || warranty.id}`);
  }
};

export const emitWarrantyCreated = (warranty: any) => {
  if (io) {
    io.emit('warranty:created', warranty);
    console.log(`📡 Emitted warranty:created for ${warranty.claimNumber || warranty.id}`);
  }
};

export const emitWarrantyDeleted = (warrantyId: string) => {
  if (io) {
    io.emit('warranty:deleted', { id: warrantyId });
    console.log(`📡 Emitted warranty:deleted for ${warrantyId}`);
  }
};

export const emitCustomerUpdate = (customer: any) => {
  if (io) {
    io.emit('customer:updated', customer);
    console.log(`📡 Emitted customer:updated for ${customer.id}`);
  }
};

export const emitCustomerCreated = (customer: any) => {
  if (io) {
    io.emit('customer:created', customer);
    console.log(`📡 Emitted customer:created for ${customer.id}`);
  }
};

export const emitCustomerDeleted = (customerId: string) => {
  if (io) {
    io.emit('customer:deleted', { id: customerId });
    console.log(`📡 Emitted customer:deleted for ${customerId}`);
  }
};

export const emitPartUpdate = (part: any) => {
  if (io) {
    io.emit('part:updated', part);
    console.log(`📡 Emitted part:updated for ${part.partNumber || part.id}`);
  }
};

export const emitPartCreated = (part: any) => {
  if (io) {
    io.emit('part:created', part);
    console.log(`📡 Emitted part:created for ${part.partNumber || part.id}`);
  }
};

export const emitPartDeleted = (partId: string) => {
  if (io) {
    io.emit('part:deleted', { id: partId });
    console.log(`📡 Emitted part:deleted for ${partId}`);
  }
};

export const emitPersonnelUpdate = (personnel: any) => {
  if (io) {
    io.emit('personnel:updated', personnel);
    console.log(`📡 Emitted personnel:updated for ${personnel.id}`);
  }
};

export const emitPersonnelCreated = (personnel: any) => {
  if (io) {
    io.emit('personnel:created', personnel);
    console.log(`📡 Emitted personnel:created for ${personnel.id}`);
  }
};

export const emitPersonnelDeleted = (personnelId: string) => {
  if (io) {
    io.emit('personnel:deleted', { id: personnelId });
    console.log(`📡 Emitted personnel:deleted for ${personnelId}`);
  }
};
