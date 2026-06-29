#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const User = require('../src/models/User');
const env = require('../src/config/env');
const chatService = require('../src/services/chatService');

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const SOCKET_BASE = BASE.replace(/\/api\/?$/, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function signToken(user) {
  return jwt.sign({ sub: user._id }, env.jwt.secret, { expiresIn: '1h' });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const employee = await User.findOne({ accountRole: 'employee', isActive: true });
  const admin = await User.findOne({ accountRole: 'admin', isActive: true });
  assert(employee && admin, 'Missing users for socket test');

  const conversation = await chatService.getOrCreateSupportConversation(employee);
  const conversationId = conversation.conversationId;
  const testText = `Socket chat test ${Date.now()}`;

  let adminReceived = false;
  let employeeReceived = false;

  const adminSocket = io(SOCKET_BASE, {
    transports: ['websocket'],
    auth: { token: signToken(admin) },
  });

  const employeeSocket = io(SOCKET_BASE, {
    transports: ['websocket'],
    auth: { token: signToken(employee) },
  });

  await Promise.all([
    new Promise((resolve, reject) => {
      adminSocket.on('connect', resolve);
      adminSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Admin socket timeout')), 8000);
    }),
    new Promise((resolve, reject) => {
      employeeSocket.on('connect', resolve);
      employeeSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Employee socket timeout')), 8000);
    }),
  ]);
  console.log('OK sockets connected');

  adminSocket.emit('chat:join', { conversationId });
  adminSocket.on('chat:message', (payload) => {
    if (payload?.message?.text === testText) adminReceived = true;
  });
  employeeSocket.on('chat:message', (payload) => {
    if (payload?.message?.text === testText) employeeReceived = true;
  });

  const response = await fetch(`${BASE}/chat/messages`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signToken(employee)}`,
    },
    body: JSON.stringify({ text: testText }),
  });
  assert(response.status === 201, 'HTTP send for socket test failed');

  await new Promise((resolve) => setTimeout(resolve, 1500));

  assert(adminReceived, 'Admin socket did not receive chat:message');
  assert(employeeReceived, 'Employee socket did not receive chat:message');
  console.log('OK realtime chat:message delivered to admin and employee');

  adminSocket.disconnect();
  employeeSocket.disconnect();
  await mongoose.disconnect();
  console.log('PASS: chat socket integration test');
}

main().catch(async (error) => {
  console.error('FAIL:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
