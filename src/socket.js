const jwt = require('jsonwebtoken');
const User = require('./models/User');
const env = require('./config/env');
const { resolveAllowedSections } = require('./services/authService');

const attachSocketIo = (server, app) => {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.set('io', io);

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, env.jwt.secret);
      const user = await User.findById(decoded.sub).select('-password');

      if (!user || !user.isActive) {
        return next(new Error('Unauthorized'));
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;

    socket.join(`user:${user._id}`);

    if (user.accountRole === 'employee') {
      socket.join(`conversation:support_${user._id}`);
    } else {
      const allowed = await resolveAllowedSections(user);
      if (allowed.includes('chat')) {
        socket.join('chat:admins');
      }
    }

    socket.on('chat:join', ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('chat:leave', ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
    });
  });

  return io;
};

module.exports = attachSocketIo;
