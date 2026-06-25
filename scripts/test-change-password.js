#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const password = 'secret123';
const newPassword = 'newpass456';

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
      name: 'Password Test Admin',
      email,
      password,
      accountRole: 'admin',
    },
  });
  assert(res.status === 201, `Register admin failed: ${JSON.stringify(res.json)}`);
  return res.json.data.token;
}

async function login(email, pass) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: { email, password: pass },
  });
  return { status: res.status, json: res.json };
}

async function createBranch(token) {
  const res = await request('/branches', {
    method: 'POST',
    token,
    body: {
      name: `Pwd Branch ${Date.now()}`,
      latitude: 25.2048,
      longitude: 55.2708,
      radiusMeters: 100,
    },
  });
  assert(res.status === 201, `Create branch failed: ${JSON.stringify(res.json)}`);
  return res.json.data.branch.branchId;
}

async function main() {
  const suffix = Date.now().toString(36);
  console.log(`Change password test against ${BASE}\n`);

  const adminToken = await registerAdmin(`pwd.admin.${suffix}@test.local`);
  const branchId = await createBranch(adminToken);

  const userEmail = `pwd.user.${suffix}@test.local`;
  let res = await request('/users', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Dashboard User',
      email: userEmail,
      password,
      groupId: 'GRP9999001',
    },
  });
  assert(res.status === 201, `Create user failed: ${JSON.stringify(res.json)}`);
  const userId = res.json.data.user.userId;

  res = await request(`/users/${userId}`, {
    method: 'PUT',
    token: adminToken,
    body: { password: newPassword },
  });
  assert(res.status === 200, `Update user password failed: ${JSON.stringify(res.json)}`);

  let loginRes = await login(userEmail, password);
  assert(loginRes.status === 401, 'Old user password should fail');

  loginRes = await login(userEmail, newPassword);
  assert(loginRes.status === 200, 'New user password should work');

  const employeeEmail = `pwd.emp.${suffix}@test.local`;
  res = await request('/employees', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Employee User',
      email: employeeEmail,
      password,
      branchId,
    },
  });
  assert(res.status === 201, `Create employee failed: ${JSON.stringify(res.json)}`);
  const employeeId = res.json.data.employee.userId;

  res = await request(`/employees/${employeeId}`, {
    method: 'PUT',
    token: adminToken,
    body: { password: newPassword },
  });
  assert(res.status === 200, `Update employee password failed: ${JSON.stringify(res.json)}`);

  loginRes = await login(employeeEmail, password);
  assert(loginRes.status === 401, 'Old employee password should fail');

  loginRes = await login(employeeEmail, newPassword);
  assert(loginRes.status === 200, 'New employee password should work');

  console.log('PASS: admin can change dashboard user and employee passwords');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
