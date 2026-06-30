#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const pushNotificationService = require('../src/services/pushNotificationService');
const chatService = require('../src/services/chatService');

const MAX_WAIT_MS = Number(process.env.FCM_WAIT_MS || 180000);
const INTERVAL_MS = 5000;

async function findEmployeeWithToken() {
  return User.findOne({
    accountRole: 'employee',
    'fcmTokens.0': { $exists: true },
  }).select('_id name fcmTokens');
}

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  await connectDB();

  const started = Date.now();
  let employee = null;

  while (Date.now() - started < MAX_WAIT_MS) {
    employee = await findEmployeeWithToken();
    if (employee) break;
    console.log('Waiting for iPhone to register FCM token...');
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }

  if (!employee) {
    console.error('TIMEOUT: No FCM token registered. Login on iPhone and allow notifications.');
    process.exit(2);
  }

  console.log(`Token found for ${employee._id} (${employee.name})`);

  const result = await pushNotificationService.notifyEmployeeChatMessage({
    employeeId: employee._id,
    senderName: 'HR Test',
    text: 'Test notification from EcoDrive Attendance. Tap to open chat.',
    conversationId: chatService.supportConversationId(employee._id),
  });

  console.log('PUSH_RESULT:', JSON.stringify(result));

  if (!result.sent) {
    console.error('Push send failed or skipped.');
    process.exit(1);
  }

  console.log(`OK: Sent ${result.sent} notification(s) to ${employee.name}`);
}

main()
  .catch((error) => {
    console.error('FAIL:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
