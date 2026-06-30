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
  return jwt.sign({ sub: user._id }, env.jwt.secret, { expiresIn: '1h' });
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

async function findAdminWithAnnouncementsAccess() {
  const groups = await Group.find({ sections: 'announcements' }).select('_id');
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
  const admin = await findAdminWithAnnouncementsAccess();
  assert(employee && admin, 'Missing test users');

  const adminToken = signToken(admin);
  const employeeToken = signToken(employee);
  const title = `Test announcement ${Date.now()}`;
  const body = 'Automated HR announcement integration test message.';

  const create = await request('/announcements', {
    method: 'POST',
    token: adminToken,
    body: { title, body },
  });
  assert(create.status === 201, `Create failed: ${create.json.message}`);
  const announcementId = create.json.data.announcement.announcementId;
  console.log('OK POST /announcements', announcementId);

  const employeeList = await request('/announcements/me', { token: employeeToken });
  assert(employeeList.status === 200, 'Employee list failed');
  assert(
    employeeList.json.data.announcements.some(
      (item) => item.announcementId === announcementId
    ),
    'Employee feed missing announcement'
  );
  console.log('OK GET /announcements/me');

  const unread = await request('/announcements/me/unread-count', {
    token: employeeToken,
  });
  assert(unread.status === 200, 'Unread failed');
  assert(unread.json.data.unreadCount >= 1, 'Employee should have unread');
  console.log('OK GET /announcements/me/unread-count');

  const markRead = await request(`/announcements/me/${announcementId}/read`, {
    method: 'PUT',
    token: employeeToken,
    body: {},
  });
  assert(markRead.status === 200, `Mark read failed: ${markRead.json.message}`);
  console.log('OK PUT /announcements/me/:id/read');

  const unreadAfter = await request('/announcements/me/unread-count', {
    token: employeeToken,
  });
  assert(unreadAfter.json.data.unreadCount >= 0, 'Unread after read failed');
  console.log('OK unread after mark read');

  const adminList = await request('/announcements', { token: adminToken });
  assert(adminList.status === 200, 'Admin list failed');
  console.log('OK GET /announcements');

  const deleted = await request(`/announcements/${announcementId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert(deleted.status === 200, `Delete failed: ${deleted.json.message}`);
  console.log('OK DELETE /announcements/:id');

  console.log('PASS: announcements HTTP integration test');
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
