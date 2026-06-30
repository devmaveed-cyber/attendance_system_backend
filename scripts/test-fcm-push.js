#!/usr/bin/env node
/**
 * Checks registered FCM tokens and optionally sends a test HR chat push.
 *
 * Usage:
 *   node scripts/test-fcm-push.js
 *   node scripts/test-fcm-push.js --send --employee-id EMP001
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const pushNotificationService = require('../src/services/pushNotificationService');
const chatService = require('../src/services/chatService');

const args = process.argv.slice(2);
const shouldSend = args.includes('--send');
const employeeIdIndex = args.indexOf('--employee-id');
const employeeIdArg =
  employeeIdIndex >= 0 ? args[employeeIdIndex + 1] : undefined;

async function listTokens() {
  const employees = await User.find({
    accountRole: 'employee',
    'fcmTokens.0': { $exists: true },
  }).select('_id name fcmTokens');

  if (!employees.length) {
    console.log('NO_TOKENS: No employee has a registered FCM token yet.');
    console.log('Ask the user to open the app on iPhone, login, and allow notifications.');
    return null;
  }

  console.log(`FOUND ${employees.length} employee(s) with FCM token(s):`);
  employees.forEach((employee) => {
    console.log(
      `- ${employee._id} (${employee.name}): ${employee.fcmTokens.length} token(s)`
    );
    employee.fcmTokens.forEach((entry) => {
      console.log(`    • ${entry.platform} @ ${entry.updatedAt.toISOString()}`);
    });
  });

  return employees;
}

async function sendTestPush(employee) {
  const conversationId = chatService.supportConversationId(employee._id);
  const text = `FCM test message ${new Date().toISOString()}`;

  const result = await pushNotificationService.notifyEmployeeChatMessage({
    employeeId: employee._id,
    senderName: 'HR Test',
    text,
    conversationId,
  });

  console.log('PUSH_RESULT:', JSON.stringify(result));
  return result;
}

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT_JSON in environment.');
    process.exit(1);
  }

  await connectDB();

  const enabled = pushNotificationService.isEnabled();
  console.log('Firebase Admin enabled:', enabled);
  if (!enabled) {
    process.exit(1);
  }

  const employees = await listTokens();
  if (!employees?.length) {
    process.exit(2);
  }

  const target =
    employeeIdArg != null
      ? employees.find((employee) => employee._id === employeeIdArg)
      : employees[0];

  if (!target) {
    console.error(`Employee not found or has no token: ${employeeIdArg}`);
    process.exit(1);
  }

  if (!shouldSend) {
    console.log(`Ready to send test push to ${target._id}. Re-run with --send`);
    process.exit(0);
  }

  const result = await sendTestPush(target);
  if (!result.sent) {
    console.error('Push was not delivered.');
    process.exit(1);
  }

  console.log(`OK: Sent ${result.sent} push notification(s) to ${target._id}`);
}

main()
  .catch((error) => {
    console.error('FAIL:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
