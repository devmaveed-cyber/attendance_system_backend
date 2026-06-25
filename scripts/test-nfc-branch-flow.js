#!/usr/bin/env node
/**
 * Integration test: NFC tag on a different branch than employee assignment
 * should still allow check-in at the tag's branch.
 */
const BASE = process.env.API_BASE || 'http://localhost:5000/api';

const suffix = Date.now().toString(36);
const adminEmail = `admin.nfc.${suffix}@test.local`;
const employeeEmail = `employee.nfc.${suffix}@test.local`;
const password = 'secret123';

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

async function main() {
  console.log(`Testing against ${BASE}`);

  let res = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'NFC Test Admin',
      email: adminEmail,
      password,
      accountRole: 'admin',
    },
  });
  assert(res.status === 201, `Admin register failed: ${JSON.stringify(res.json)}`);
  const adminToken = res.json.data.token;

  res = await request('/branches', {
    method: 'POST',
    token: adminToken,
    body: {
      name: `Branch A ${suffix}`,
      address: 'A',
      latitude: 25.14758,
      longitude: 55.241171,
      radiusMeters: 500,
    },
  });
  assert(res.status === 201, `Branch A create failed: ${JSON.stringify(res.json)}`);
  const branchA = res.json.data.branch.branchId;

  res = await request('/branches', {
    method: 'POST',
    token: adminToken,
    body: {
      name: `Branch B ${suffix}`,
      address: 'B',
      latitude: 25.15000,
      longitude: 55.245000,
      radiusMeters: 500,
    },
  });
  assert(res.status === 201, `Branch B create failed: ${JSON.stringify(res.json)}`);
  const branchB = res.json.data.branch.branchId;

  res = await request('/employees', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'NFC Test Employee',
      email: employeeEmail,
      password,
      phone: '0500000000',
      branchId: branchA,
    },
  });
  assert(res.status === 201, `Employee create failed: ${JSON.stringify(res.json)}`);
  const employeeId = res.json.data.employee.employeeId;

  res = await request('/nfc-tags', {
    method: 'POST',
    token: adminToken,
    body: {
      tagUid: `04TEST${suffix.toUpperCase()}90`,
      branchId: branchB,
      label: 'Moved tag',
      isActive: true,
    },
  });
  assert(res.status === 201, `NFC tag create failed: ${JSON.stringify(res.json)}`);
  const tagUid = res.json.data.nfcTag.tagUid;

  res = await request('/auth/login', {
    method: 'POST',
    body: { email: employeeEmail, password },
  });
  assert(res.status === 200, `Employee login failed: ${JSON.stringify(res.json)}`);
  const employeeToken = res.json.data.token;

  res = await request('/attendance/mark-nfc', {
    method: 'POST',
    token: employeeToken,
    body: {
      type: 'checkIn',
      tagUid,
      latitude: 25.15000,
      longitude: 55.245000,
      accuracy: 10,
    },
  });

  assert(
    res.status === 200,
    `Expected NFC check-in success across branches, got ${res.status}: ${JSON.stringify(res.json)}`
  );
  assert(
    res.json.data.record.branchId === branchB,
    `Expected attendance on branch B, got ${res.json.data.record.branchId}`
  );

  res = await request('/employees', { token: adminToken });
  const employee = res.json.data.employees.find((e) => e.employeeId === employeeId);
  assert(employee?.branchId === branchB, `Expected employee synced to branch B, got ${employee?.branchId}`);

  console.log('PASS: NFC check-in works when tag branch differs from initial employee branch');
  console.log(`  employee=${employeeId}, branchA=${branchA}, branchB=${branchB}, tag=${tagUid}`);
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
