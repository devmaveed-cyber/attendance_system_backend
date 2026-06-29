#!/usr/bin/env node
/**
 * Smoke test chat routes + socket auth without real credentials.
 * Usage: API_BASE=http://localhost:5000/api node scripts/smoke-chat-routes.js
 */
const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const SOCKET_BASE = BASE.replace(/\/api\/?$/, '');

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
  if (!condition) throw new Error(message);
}

async function main() {
  const checks = [
    ['GET', '/chat/unread-count', 401],
    ['GET', '/chat/conversations', 401],
    ['POST', '/chat/support', 401],
    ['POST', '/chat/messages', 401],
  ];

  for (const [method, path, expectedStatus] of checks) {
    const { status, json } = await request(path, {
      method,
      body: method === 'POST' ? {} : undefined,
    });
    assert(
      status === expectedStatus,
      `${method} ${path} expected ${expectedStatus}, got ${status} (${json.message || 'no message'})`
    );
    console.log(`OK ${method} ${path} -> ${status}`);
  }

  const invalidConv = await request('/chat/conversations/not_valid/messages', {
    token: 'fake',
  });
  assert(
    invalidConv.status === 401 || invalidConv.status === 403,
    `Invalid conversation route unexpected status ${invalidConv.status}`
  );
  console.log('OK invalid conversation id guarded');

  const socketPoll = await fetch(
    `${SOCKET_BASE}/socket.io/?EIO=4&transport=polling`
  );
  assert(socketPoll.ok, `Socket.IO polling failed: ${socketPoll.status}`);
  console.log('OK Socket.IO endpoint reachable');

  console.log('PASS: chat route smoke test');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
