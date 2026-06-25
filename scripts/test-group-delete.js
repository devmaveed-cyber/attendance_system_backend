#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const suffix = Date.now().toString(36);

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

async function main() {
  const adminEmail = `admin.groupdel.${suffix}@test.local`;

  let res = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Group Delete Test Admin',
      email: adminEmail,
      password: 'secret123',
      accountRole: 'admin',
    },
  });
  if (res.status !== 201) {
    throw new Error(`Register failed: ${JSON.stringify(res.json)}`);
  }
  const token = res.json.data.token;

  res = await request('/groups', {
    method: 'POST',
    token,
    body: {
      name: `Delete Me ${suffix}`,
      sections: ['dashboard', 'attendance'],
    },
  });
  if (res.status !== 201) {
    throw new Error(`Create group failed: ${JSON.stringify(res.json)}`);
  }
  const groupId = res.json.data.group.groupId;

  res = await request(`/groups/${groupId}`, { method: 'DELETE', token });
  if (res.status !== 200) {
    throw new Error(`Delete group failed: ${JSON.stringify(res.json)}`);
  }

  res = await request('/groups', { token });
  const stillExists = (res.json.data.groups || []).some((g) => g.groupId === groupId);
  if (stillExists) {
    throw new Error('Deleted group still appears in list');
  }

  res = await request('/groups/GRP9999001', { method: 'DELETE', token });
  if (res.status !== 400) {
    throw new Error(`Expected system group delete to fail, got ${res.status}`);
  }

  console.log('PASS: group delete wired correctly');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
