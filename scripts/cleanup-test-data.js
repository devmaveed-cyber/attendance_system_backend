#!/usr/bin/env node
/**
 * Remove integration-test residue from MongoDB.
 * Safe patterns only — real user data (non @test.local emails, real branch/group names) is kept.
 *
 * Usage:
 *   node scripts/cleanup-test-data.js          # delete
 *   node scripts/cleanup-test-data.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const Branch = require('../src/models/Branch');
const Group = require('../src/models/Group');
const NfcTag = require('../src/models/NfcTag');
const User = require('../src/models/User');

const dryRun = process.argv.includes('--dry-run');

const TEST_USER_EMAIL = /@test\.local$/i;
const TEST_PROBE_EMAIL = /^deploy\.probe\.\d+@test\.local$/i;
const TEST_BRANCH_NAME =
  /^(Branch [AB] [a-z0-9]+|Pwd Branch \d+)$/i;
const TEST_GROUP_NAME =
  /^(Users Only [a-z0-9]+|Dash Branch [a-z0-9]+|Delete Me [a-z0-9]+)$/i;
const TEST_TAG_UID = /^04TEST/i;
const TEST_USER_NAMES = [
  /^NFC Test (Admin|Employee)$/,
  /^Audit Admin$/,
  /^Limited Admin$/,
  /^Group Delete Test Admin$/,
  /^Password Test Admin$/,
  /^Dashboard User$/,
  /^Employee User$/,
  /^DeployProbe$/,
  /^Probe$/,
];

async function findTestUsers() {
  return User.find({
    $or: [
      { email: TEST_USER_EMAIL },
      { email: TEST_PROBE_EMAIL },
      ...TEST_USER_NAMES.map((pattern) => ({ name: pattern })),
    ],
  });
}

async function findTestBranches() {
  return Branch.find({
    name: TEST_BRANCH_NAME,
  });
}

async function findTestGroups() {
  return Group.find({
    isSystem: { $ne: true },
    name: TEST_GROUP_NAME,
  });
}

async function findTestTags(testBranchIds) {
  const or = [{ tagUid: TEST_TAG_UID }];
  if (testBranchIds.length) {
    or.push({ branchId: { $in: testBranchIds } });
    or.push({ label: 'Moved tag', branchId: { $in: testBranchIds } });
  }
  return NfcTag.find({ $or: or });
}

function printSection(title, items, formatter) {
  console.log(`\n${title} (${items.length})`);
  if (!items.length) {
    console.log('  (none)');
    return;
  }
  for (const item of items) {
    console.log(`  - ${formatter(item)}`);
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${dryRun ? ' [DRY RUN]' : ''}`);

  const testUsers = await findTestUsers();
  const testUserIds = testUsers.map((user) => user._id);

  const testBranches = await findTestBranches();
  const testBranchIds = testBranches.map((branch) => branch._id);

  const testGroups = await findTestGroups();
  const testGroupIds = testGroups.map((group) => group._id);

  const testTags = await findTestTags(testBranchIds);
  const testTagIds = testTags.map((tag) => tag._id);

  const attendanceFilter = {
    $or: [
      ...(testUserIds.length ? [{ userId: { $in: testUserIds } }] : []),
      ...(testBranchIds.length ? [{ branchId: { $in: testBranchIds } }] : []),
    ],
  };
  const attendanceCount = attendanceFilter.$or.length
    ? await AttendanceRecord.countDocuments(attendanceFilter)
    : 0;

  printSection('Users to remove', testUsers, (u) => `${u._id} ${u.email} (${u.name})`);
  printSection('Branches to remove', testBranches, (b) => `${b._id} ${b.name}`);
  printSection('Groups to remove', testGroups, (g) => `${g._id} ${g.name}`);
  printSection('NFC tags to remove', testTags, (t) => `${t._id} ${t.tagUid} @ ${t.branchId}`);
  console.log(`\nAttendance records to remove: ${attendanceCount}`);

  const total =
    testUsers.length +
    testBranches.length +
    testGroups.length +
    testTags.length +
    attendanceCount;

  if (total === 0) {
    console.log('\nNo test data found. Database is clean.');
    await mongoose.disconnect();
    return;
  }

  if (dryRun) {
    console.log('\nDry run only — nothing deleted. Re-run without --dry-run to delete.');
    await mongoose.disconnect();
    return;
  }

  const attendanceResult = attendanceFilter.$or.length
    ? await AttendanceRecord.deleteMany(attendanceFilter)
    : { deletedCount: 0 };

  const tagResult = testTagIds.length
    ? await NfcTag.deleteMany({ _id: { $in: testTagIds } })
    : { deletedCount: 0 };

  if (testGroupIds.length) {
    await User.updateMany(
      { groupId: { $in: testGroupIds } },
      { $set: { groupId: '', groupName: '' } }
    );
  }

  const userResult = testUserIds.length
    ? await User.deleteMany({ _id: { $in: testUserIds } })
    : { deletedCount: 0 };

  const branchResult = testBranchIds.length
    ? await Branch.deleteMany({ _id: { $in: testBranchIds } })
    : { deletedCount: 0 };

  const groupResult = testGroupIds.length
    ? await Group.deleteMany({ _id: { $in: testGroupIds } })
    : { deletedCount: 0 };

  console.log('\nCleanup complete:');
  console.log(`  attendance records: ${attendanceResult.deletedCount}`);
  console.log(`  nfc tags: ${tagResult.deletedCount}`);
  console.log(`  users: ${userResult.deletedCount}`);
  console.log(`  branches: ${branchResult.deletedCount}`);
  console.log(`  groups: ${groupResult.deletedCount}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Cleanup failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
