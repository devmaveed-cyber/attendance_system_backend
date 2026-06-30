const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateDashboardDayStats,
  buildOverviewSummary,
} = require('../src/utils/attendanceOverviewBuilder');

test('buildOverviewSummary counts present, absent, late, and early leave', () => {
  const summary = buildOverviewSummary([
    {
      employeeId: 'E1',
      status: 'checked_in',
      isLateCheckIn: true,
      isEarlyCheckOut: false,
      shiftStatus: 'late',
    },
    {
      employeeId: 'E2',
      status: 'checked_out',
      isLateCheckIn: false,
      isEarlyCheckOut: true,
      shiftStatus: 'early_leave',
    },
    {
      employeeId: 'E3',
      status: 'absent',
      isLateCheckIn: false,
      isEarlyCheckOut: false,
      shiftStatus: 'absent',
    },
  ]);

  assert.equal(summary.totalRows, 3);
  assert.equal(summary.employeeCount, 3);
  assert.equal(summary.checkedInCount, 2);
  assert.equal(summary.checkedOutCount, 1);
  assert.equal(summary.lateCount, 1);
  assert.equal(summary.earlyLeaveCount, 1);
});

test('aggregateDashboardDayStats builds branch and method buckets', () => {
  const aggregated = aggregateDashboardDayStats([
    {
      employeeId: 'E1',
      branchId: 'B1',
      branchName: 'Dubai',
      status: 'checked_in',
      checkInMethod: 'nfc',
      isLateCheckIn: false,
      isEarlyCheckOut: false,
    },
    {
      employeeId: 'E2',
      branchId: 'B1',
      branchName: 'Dubai',
      status: 'checked_out',
      checkInMethod: 'gps',
      isLateCheckIn: false,
      isEarlyCheckOut: false,
    },
    {
      employeeId: 'E3',
      branchId: 'B2',
      branchName: 'Abu Dhabi',
      status: 'absent',
      checkInMethod: null,
      isLateCheckIn: false,
      isEarlyCheckOut: false,
    },
  ]);

  assert.equal(aggregated.summary.onTimeCount, 2);
  assert.equal(aggregated.byBranch.length, 2);
  assert.equal(aggregated.byMethod.length, 2);

  const dubai = aggregated.byBranch.find((entry) => entry.branchName === 'Dubai');
  assert.ok(dubai);
  assert.equal(dubai.present, 2);
  assert.equal(dubai.completed, 1);
  assert.equal(dubai.absent, 0);
});
