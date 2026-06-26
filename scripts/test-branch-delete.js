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
  const adminEmail = `admin.branchdel.${suffix}@test.local`;

  let res = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Branch Delete Test Admin',
      email: adminEmail,
      password: 'secret123',
      accountRole: 'admin',
    },
  });
  if (res.status !== 201) {
    throw new Error(`Register failed: ${JSON.stringify(res.json)}`);
  }
  const token = res.json.data.token;

  res = await request('/branches', {
    method: 'POST',
    token,
    body: {
      name: `Delete Me Branch ${suffix}`,
      address: 'Test address',
      latitude: 25.14758,
      longitude: 55.241171,
      radiusMeters: 120,
    },
  });
  if (res.status !== 201) {
    throw new Error(`Create branch failed: ${JSON.stringify(res.json)}`);
  }
  const branchId = res.json.data.branch.branchId;

  res = await request(`/branches/${branchId}`, { method: 'DELETE', token });
  if (res.status !== 200) {
    throw new Error(`Delete branch failed: ${JSON.stringify(res.json)}`);
  }

  res = await request('/branches', { token });
  const stillExists = (res.json.data.branches || []).some(
    (branch) => branch.branchId === branchId
  );
  if (stillExists) {
    throw new Error('Deleted branch still appears in list');
  }

  console.log('PASS: branch delete wired correctly');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
