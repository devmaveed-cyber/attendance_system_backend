#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const Branch = require('../src/models/Branch');
const NfcTag = require('../src/models/NfcTag');
const User = require('../src/models/User');

const TEST_BRANCH_NAME = /^Branch [AB] [a-z0-9]+$/i;
const TEST_USER_EMAIL = /@test\.local$/i;
const TEST_TAG_UID = /^04TEST/i;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const testUsers = await User.find({
    $or: [
      { email: TEST_USER_EMAIL },
      { name: /^NFC Test (Admin|Employee)$/ },
    ],
  });
  const testUserIds = testUsers.map((user) => user._id);

  const testBranches = await Branch.find({
    $or: [
      { name: TEST_BRANCH_NAME },
      { _id: { $in: ['BRN0000003', 'BRN0000004', 'BRN0000005', 'BRN0000006'] } },
    ],
  });
  const testBranchIds = testBranches.map((branch) => branch._id);

  const testTags = await NfcTag.find({
    $or: [
      { tagUid: TEST_TAG_UID },
      { label: 'Moved tag', branchId: { $in: testBranchIds } },
    ],
  });
  const testTagIds = testTags.map((tag) => tag._id);

  const attendanceResult = testUserIds.length
    ? await AttendanceRecord.deleteMany({ userId: { $in: testUserIds } })
    : { deletedCount: 0 };

  const tagResult = testTagIds.length
    ? await NfcTag.deleteMany({ _id: { $in: testTagIds } })
    : { deletedCount: 0 };

  const userResult = testUserIds.length
    ? await User.deleteMany({ _id: { $in: testUserIds } })
    : { deletedCount: 0 };

  const branchResult = testBranchIds.length
    ? await Branch.deleteMany({ _id: { $in: testBranchIds } })
    : { deletedCount: 0 };

  console.log('Cleanup complete:');
  console.log(`  attendance records: ${attendanceResult.deletedCount}`);
  console.log(`  nfc tags: ${tagResult.deletedCount}`);
  console.log(`  users: ${userResult.deletedCount}`);
  console.log(`  branches: ${branchResult.deletedCount}`);

  if (testBranches.length) {
    console.log('  removed branches:', testBranches.map((b) => `${b._id} (${b.name})`).join(', '));
  }
  if (testTags.length) {
    console.log('  removed tags:', testTags.map((t) => `${t._id} (${t.tagUid})`).join(', '));
  }
  if (testUsers.length) {
    console.log('  removed users:', testUsers.map((u) => `${u._id} (${u.email})`).join(', '));
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Cleanup failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
