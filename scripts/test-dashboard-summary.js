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

async function login(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert(res.status === 200, `Login failed: ${JSON.stringify(res.json)}`);
  return res.json.data.token;
}

async function main() {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      'SKIP: set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env to run live API test'
    );
    process.exit(0);
  }

  const token = await login(email, password);
  const started = Date.now();
  const res = await request('/dashboard/summary?trendDays=7', { token });
  const elapsed = Date.now() - started;

  assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);

  const summary = res.json.data?.summary;
  assert(summary, 'Missing summary payload');
  assert(summary.counts, 'Missing counts');
  assert(typeof summary.counts.employees === 'number', 'Missing employee count');
  assert(summary.today, 'Missing today snapshot for admin with attendance access');
  assert(Array.isArray(summary.weekTrend), 'Missing weekTrend');
  assert(summary.weekTrend.length === 7, 'Expected 7 trend points');
  assert(summary.today.summary, 'Missing today summary');
  assert(Array.isArray(summary.today.byBranch), 'Missing byBranch');
  assert(Array.isArray(summary.today.byMethod), 'Missing byMethod');

  console.log('PASS: /dashboard/summary');
  console.log(`  employees=${summary.counts.employees}`);
  console.log(`  branches=${summary.counts.branches}`);
  console.log(`  presentToday=${summary.today.summary.checkedInCount}`);
  console.log(`  source=${summary.today.source || 'unknown'}`);
  console.log(`  responseTimeMs=${elapsed}`);
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
