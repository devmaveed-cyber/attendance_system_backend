#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const env = require('../src/config/env');

const BASE = process.env.API_BASE || 'http://localhost:5000/api';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function signToken(user) {
  return jwt.sign({ sub: user._id }, env.jwt.secret, {
    expiresIn: '1h',
  });
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function findAdminWithChatAccess() {
  const groups = await Group.find({ sections: 'chat' }).select('_id');
  const groupIds = groups.map((group) => group._id);
  if (groupIds.length === 0) {
    return User.findOne({ accountRole: 'admin', isActive: true });
  }
  return User.findOne({
    accountRole: 'admin',
    isActive: true,
    groupId: { $in: groupIds },
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const employee = await User.findOne({ accountRole: 'employee', isActive: true });
  const admin = await findAdminWithChatAccess();
  assert(employee && admin, 'Missing test users');

  const employeeToken = signToken(employee);
  const adminToken = signToken(admin);
  const employeeText = `HTTP chat test employee ${Date.now()}`;
  const adminText = `HTTP chat test admin ${Date.now()}`;

  const openSupport = await request('/chat/support', {
    method: 'POST',
    token: employeeToken,
    body: {},
  });
  assert(openSupport.status === 200, `Open support failed: ${openSupport.json.message}`);
  const conversationId = openSupport.json.data.conversation.conversationId;
  console.log('OK POST /chat/support');

  const employeeSend = await request('/chat/messages', {
    method: 'POST',
    token: employeeToken,
    body: { text: employeeText },
  });
  assert(employeeSend.status === 201, `Employee send failed: ${employeeSend.json.message}`);
  console.log('OK POST /chat/messages');

  const adminList = await request('/chat/conversations', { token: adminToken });
  assert(adminList.status === 200, `Admin list failed: ${adminList.json.message}`);
  assert(
    adminList.json.data.conversations.some(
      (item) => item.conversationId === conversationId
    ),
    'Admin inbox missing conversation'
  );
  console.log('OK GET /chat/conversations');

  const adminSend = await request(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: adminToken,
    body: { text: adminText },
  });
  assert(adminSend.status === 201, `Admin send failed: ${adminSend.json.message}`);
  console.log('OK POST /chat/conversations/:id/messages');

  const history = await request(
    `/chat/conversations/${conversationId}/messages?limit=20`,
    { token: employeeToken }
  );
  assert(history.status === 200, `History failed: ${history.json.message}`);
  const texts = history.json.data.messages.map((item) => item.text);
  assert(texts.includes(employeeText), 'History missing employee message');
  assert(texts.includes(adminText), 'History missing admin message');
  console.log('OK GET /chat/conversations/:id/messages');

  const unread = await request('/chat/unread-count', { token: employeeToken });
  assert(unread.status === 200, 'Unread count failed');
  assert(unread.json.data.unreadCount >= 1, 'Employee should have unread');
  console.log('OK GET /chat/unread-count');

  const markRead = await request(`/chat/conversations/${conversationId}/read`, {
    method: 'PUT',
    token: employeeToken,
    body: {},
  });
  assert(markRead.status === 200, `Mark read failed: ${markRead.json.message}`);
  console.log('OK PUT /chat/conversations/:id/read');

  const unreadAfter = await request('/chat/unread-count', { token: employeeToken });
  assert(unreadAfter.json.data.unreadCount === 0, 'Unread should be 0 after read');
  console.log('OK unread cleared after mark read');

  console.log('PASS: chat HTTP integration test');
  await mongoose.disconnect();
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
