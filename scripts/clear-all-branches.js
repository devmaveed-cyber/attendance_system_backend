#!/usr/bin/env node
/**
 * Remove ALL branches and clear branch references on related collections.
 *
 * Usage:
 *   node scripts/clear-all-branches.js          # delete
 *   node scripts/clear-all-branches.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const Branch = require('../src/models/Branch');
const Counter = require('../src/models/Counter');
const NfcTag = require('../src/models/NfcTag');
const User = require('../src/models/User');
const { ID_PREFIX } = require('../src/utils/idGenerator');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${dryRun ? ' [DRY RUN]' : ''}`);

  const branchCount = await Branch.countDocuments();
  const usersWithBranch = await User.countDocuments({
    $or: [{ branchId: { $ne: '' } }, { branchName: { $ne: '' } }],
  });
  const tagsWithBranch = await NfcTag.countDocuments({
    $or: [{ branchId: { $ne: '' } }, { branchName: { $ne: '' } }],
  });
  const recordsWithBranch = await AttendanceRecord.countDocuments({
    $or: [{ branchId: { $ne: '' } }, { branchName: { $ne: '' } }],
  });

  console.log('\nCurrent counts:');
  console.log(`  branches: ${branchCount}`);
  console.log(`  users with branch refs: ${usersWithBranch}`);
  console.log(`  nfc tags with branch refs: ${tagsWithBranch}`);
  console.log(`  attendance records with branch refs: ${recordsWithBranch}`);

  if (branchCount === 0 && usersWithBranch === 0 && tagsWithBranch === 0 && recordsWithBranch === 0) {
    console.log('\nNo branch data found. Database already has 0 branches.');
    await mongoose.disconnect();
    return;
  }

  if (dryRun) {
    console.log('\nDry run only — nothing deleted. Re-run without --dry-run to delete.');
    await mongoose.disconnect();
    return;
  }

  const branchResult = await Branch.deleteMany({});
  const userResult = await User.updateMany(
    {},
    { $set: { branchId: '', branchName: '' } }
  );
  const tagResult = await NfcTag.updateMany(
    {},
    { $set: { branchId: '', branchName: '' } }
  );
  const recordResult = await AttendanceRecord.updateMany(
    {},
    { $set: { branchId: '', branchName: '' } }
  );
  await Counter.findByIdAndUpdate(
    ID_PREFIX.BRANCH,
    { $set: { seq: 0 } },
    { upsert: true }
  );

  const remainingBranches = await Branch.countDocuments();

  console.log('\nCleanup complete:');
  console.log(`  branches deleted: ${branchResult.deletedCount}`);
  console.log(`  users updated: ${userResult.modifiedCount}`);
  console.log(`  nfc tags updated: ${tagResult.modifiedCount}`);
  console.log(`  attendance records updated: ${recordResult.modifiedCount}`);
  console.log(`  branch ID counter reset to 0`);
  console.log(`  remaining branches: ${remainingBranches}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Cleanup failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
