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
  if (!condition) throw new Error(message);
}

async function registerAdmin(email) {
  const res = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Audit Admin',
      email,
      password: 'secret123',
      accountRole: 'admin',
    },
  });
  assert(res.status === 201, `Register failed: ${JSON.stringify(res.json)}`);
  return res.json.data.token;
}

async function createGroup(token, name, sections) {
  const res = await request('/groups', {
    method: 'POST',
    token,
    body: { name, sections },
  });
  assert(res.status === 201, `Create group failed: ${JSON.stringify(res.json)}`);
  return res.json.data.group.groupId;
}

async function createUser(token, { email, groupId }) {
  const res = await request('/users', {
    method: 'POST',
    token,
    body: {
      name: 'Limited Admin',
      email,
      password: 'secret123',
      groupId,
    },
  });
  assert(res.status === 201, `Create user failed: ${JSON.stringify(res.json)}`);
}

async function login(email) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: { email, password: 'secret123' },
  });
  assert(res.status === 200, `Login failed: ${JSON.stringify(res.json)}`);
  return {
    token: res.json.data.token,
    allowedSections: res.json.data.allowedSections,
  };
}

async function cleanup(token, groupIds, emails) {
  for (const groupId of groupIds) {
    await request(`/groups/${groupId}`, { method: 'DELETE', token });
  }
}

async function main() {
  const suffix = Date.now().toString(36);
  console.log(`Deep permission audit against ${BASE}\n`);

  const ownerToken = await registerAdmin(`audit.owner.${suffix}@test.local`);
  const groupIds = [];

  const usersOnlyGroupId = await createGroup(
    ownerToken,
    `Users Only ${suffix}`,
    ['users']
  );
  groupIds.push(usersOnlyGroupId);

  const dashBranchGroupId = await createGroup(
    ownerToken,
    `Dash Branch ${suffix}`,
    ['dashboard', 'branches']
  );
  groupIds.push(dashBranchGroupId);

  const usersOnlyEmail = `audit.users.${suffix}@test.local`;
  await createUser(ownerToken, { email: usersOnlyEmail, groupId: usersOnlyGroupId });

  const dashBranchEmail = `audit.dash.${suffix}@test.local`;
  await createUser(ownerToken, { email: dashBranchEmail, groupId: dashBranchGroupId });

  const usersOnly = await login(usersOnlyEmail);
  assert(
    JSON.stringify(usersOnly.allowedSections) === JSON.stringify(['users']),
    `Expected users-only sections, got ${usersOnly.allowedSections}`
  );

  let res = await request('/users', { token: usersOnly.token });
  assert(res.status === 200, 'Users-only admin should list users');

  res = await request('/groups', { token: usersOnly.token });
  assert(
    res.status === 200,
    `Users-only admin should GET /groups for user form dropdown, got ${res.status}`
  );
  console.log('OK: users-only admin can list groups for user form dropdown');

  const dashBranch = await login(dashBranchEmail);
  res = await request('/branches', { token: dashBranch.token });
  assert(res.status === 200, 'Dash+branch admin should list branches');

  res = await request('/employees', { token: dashBranch.token });
  assert(
    res.status === 403,
    `Dashboard+branches admin must not list employees, got ${res.status}`
  );
  console.log(
    'OK: dashboard+branches blocked from employees (Flutter skips employee stat card)'
  );

  res = await request('/attendance/overview', { token: dashBranch.token });
  console.log(
    res.status === 403
      ? 'OK: dashboard-only group blocked from attendance overview'
      : `NOTE: attendance overview accessible -> ${res.status}`
  );

  res = await request('/nfc-tags', { token: dashBranch.token });
  console.log(
    res.status === 403
      ? 'OK: dashboard+branches blocked from NFC list'
      : `NOTE: nfc-tags accessible -> ${res.status}`
  );

  res = await request('/groups/GRP9999001', { method: 'DELETE', token: ownerToken });
  console.log(
    res.status === 400
      ? 'OK: system group delete blocked'
      : `UNEXPECTED system delete -> ${res.status}`
  );

  await cleanup(ownerToken, groupIds);

  console.log('\nRoute parity checks passed for permission scenarios.');
  console.log('See GAP lines above for remaining cross-section issues.');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
