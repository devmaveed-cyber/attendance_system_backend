#!/usr/bin/env node
/**
 * Migrate employee _id values from legacy EMP0000001 format to HR EMP No.
 *
 * Usage:
 *   node scripts/migrate-employee-ids-to-empno.js --dry-run
 *   node scripts/migrate-employee-ids-to-empno.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const {
  normalizeEmpNo,
  isEmpNo,
  isLegacyEmployeeId,
} = require('../src/utils/employeeId');

const dryRun = process.argv.includes('--dry-run');

const buildRecordId = (userId, dateKey) => `${userId}_${dateKey}`;

async function migrateEmployee(employee, summary) {
  const oldId = employee._id;
  const newId = normalizeEmpNo(employee.empNo);

  if (!newId || !isEmpNo(newId)) {
    summary.skippedMissingEmpNo += 1;
    summary.skipped.push({ oldId, name: employee.name, reason: 'Missing EMP number' });
    return;
  }

  if (oldId === newId) {
    summary.alreadyMigrated += 1;
    return;
  }

  if (!isLegacyEmployeeId(oldId)) {
    summary.skippedNonLegacy += 1;
    summary.skipped.push({ oldId, name: employee.name, reason: 'Not a legacy EMP id' });
    return;
  }

  const conflict = await User.findById(newId).lean();
  if (conflict && conflict._id !== oldId) {
    summary.conflicts += 1;
    summary.skipped.push({
      oldId,
      newId,
      name: employee.name,
      reason: 'Target EMP number already exists',
    });
    return;
  }

  const records = await AttendanceRecord.find({ userId: oldId }).lean();
  summary.attendanceRecordsToMove += records.length;

  if (dryRun) {
    summary.plannedMigrations += 1;
    summary.planned.push({ oldId, newId, name: employee.name, records: records.length });
    return;
  }

  for (const record of records) {
    const nextRecordId = buildRecordId(newId, record.dateKey);
    const nextRecord = {
      ...record,
      _id: nextRecordId,
      recordId: nextRecordId,
      userId: newId,
    };

    await AttendanceRecord.deleteOne({ _id: record._id });
    await AttendanceRecord.create(nextRecord);
  }

  const userDoc = employee.toObject();
  delete userDoc.__v;
  userDoc._id = newId;
  userDoc.empNo = newId;

  await User.deleteOne({ _id: oldId });
  await User.create(userDoc);

  summary.migrated += 1;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${dryRun ? ' [DRY RUN]' : ''}`);

  const employees = await User.find({ accountRole: 'employee' })
    .select('+password')
    .sort({ createdAt: 1 });
  const summary = {
    totalEmployees: employees.length,
    migrated: 0,
    plannedMigrations: 0,
    alreadyMigrated: 0,
    skippedMissingEmpNo: 0,
    skippedNonLegacy: 0,
    conflicts: 0,
    attendanceRecordsToMove: 0,
    planned: [],
    skipped: [],
  };

  for (const employee of employees) {
    await migrateEmployee(employee, summary);
  }

  console.log('\nSummary:');
  console.log(JSON.stringify({ ...summary, planned: undefined, skipped: undefined }, null, 2));

  if (summary.planned.length) {
    console.log('\nPlanned migrations:');
    for (const item of summary.planned.slice(0, 10)) {
      console.log(`  ${item.oldId} -> ${item.newId} (${item.name}) records=${item.records}`);
    }
    if (summary.planned.length > 10) {
      console.log(`  ... and ${summary.planned.length - 10} more`);
    }
  }

  if (summary.skipped.length) {
    console.log('\nSkipped:');
    for (const item of summary.skipped) {
      console.log(`  ${item.oldId} ${item.name}: ${item.reason}`);
    }
  }

  if (dryRun) {
    console.log('\nDry run only — nothing changed. Re-run without --dry-run to migrate.');
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
