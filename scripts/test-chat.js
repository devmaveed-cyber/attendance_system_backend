#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.API_BASE || 'http://localhost:5000/api';

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function login({ email, phone, password }) {
  const payload = email ? { email, password } : { phone, password };
  const { status, json } = await request('/auth/login', {
    method: 'POST',
    body: payload,
  });
  assert(status === 200 && json.success, `Login failed: ${json.message || status}`);
  return json.data.token;
}

async function main() {
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'secret123';
  const employeePhone = process.env.TEST_EMPLOYEE_PHONE;
  const employeePassword = process.env.TEST_EMPLOYEE_PASSWORD || 'ecodrive@10005';

  if (!adminEmail || !employeePhone) {
    console.log(
      'Set TEST_ADMIN_EMAIL and TEST_EMPLOYEE_PHONE in .env to run chat integration test.'
    );
    process.exit(0);
  }

  const adminToken = await login({ email: adminEmail, password: adminPassword });
  const employeeToken = await login({
    phone: employeePhone,
    password: employeePassword,
  });

  const openSupport = await request('/chat/support', {
    method: 'POST',
    token: employeeToken,
  });
  assert(openSupport.status === 200, 'Employee open support failed');
  const conversationId = openSupport.json.data.conversation.conversationId;
  console.log('Conversation:', conversationId);

  const employeeSend = await request('/chat/messages', {
    method: 'POST',
    token: employeeToken,
    body: { text: 'Hello HR, this is an automated chat test.' },
  });
  assert(employeeSend.status === 201, 'Employee send failed');
  console.log('Employee message sent');

  const adminList = await request('/chat/conversations', { token: adminToken });
  assert(adminList.status === 200, `Admin list failed: ${adminList.json.message}`);
  assert(
    adminList.json.data.conversations.some(
      (item) => item.conversationId === conversationId
    ),
    'Admin inbox missing employee conversation'
  );
  console.log('Admin inbox contains conversation');

  const adminSend = await request(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: adminToken,
    body: { text: 'HR reply from automated chat test.' },
  });
  assert(adminSend.status === 201, `Admin send failed: ${adminSend.json.message}`);
  console.log('Admin reply sent');

  const unreadEmployee = await request('/chat/unread-count', {
    token: employeeToken,
  });
  assert(unreadEmployee.status === 200, 'Employee unread failed');
  assert(unreadEmployee.json.data.unreadCount >= 1, 'Employee should have unread');
  console.log('Employee unread count:', unreadEmployee.json.data.unreadCount);

  const markRead = await request(`/chat/conversations/${conversationId}/read`, {
    method: 'PUT',
    token: employeeToken,
  });
  assert(markRead.status === 200, 'Mark read failed');
  console.log('Employee marked conversation read');

  console.log('PASS: chat integration test');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
