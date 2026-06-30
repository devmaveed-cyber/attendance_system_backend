const AttendanceRecord = require('../models/AttendanceRecord');
const Branch = require('../models/Branch');
const User = require('../models/User');
const { evaluateShiftStatus } = require('./shiftUtils');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dateKeyFor = (date = new Date()) => {
  const y = date.getFullYear().toString().padStart(4, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateKeyFromDate = (date) => {
  const y = date.getFullYear().toString().padStart(4, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const listDateKeysInRange = (startDate, endDate) => {
  const keys = [];
  const current = parseDateKey(startDate);
  const end = parseDateKey(endDate);

  while (current <= end) {
    keys.push(formatDateKeyFromDate(current));
    current.setDate(current.getDate() + 1);
  }

  return keys;
};

const loadBranchMap = async (branchIds) => {
  const uniqueIds = [...new Set(branchIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const branches = await Branch.find({ _id: { $in: uniqueIds } });
  return new Map(branches.map((branch) => [branch._id, branch]));
};

const buildOverviewRowFields = (record, branch) => {
  const shift = evaluateShiftStatus(record, branch);

  return {
    recordId: record?.recordId || record?._id || null,
    checkInAt: record?.checkInAt ?? null,
    checkOutAt: record?.checkOutAt ?? null,
    checkInMethod: record?.checkInMethod ?? null,
    checkOutMethod: record?.checkOutMethod ?? null,
    isManualCorrected: Boolean(record?.correctedAt),
    correctedByName: record?.correctedByName ?? null,
    correctionReason: record?.correctionReason ?? null,
    status: shift.status,
    shiftStatus: shift.shiftStatus,
    isLateCheckIn: shift.isLateCheckIn,
    isEarlyCheckOut: shift.isEarlyCheckOut,
    minutesLate: shift.minutesLate,
    minutesEarlyCheckout: shift.minutesEarlyCheckout,
    shiftStartTime: shift.shiftStartTime,
    shiftEndTime: shift.shiftEndTime,
    graceMinutesLate: shift.graceMinutesLate,
  };
};

const buildOverviewSummary = (rows) => {
  const employeeIds = new Set();

  let checkedInCount = 0;
  let checkedOutCount = 0;
  let lateCount = 0;
  let earlyLeaveCount = 0;

  rows.forEach((row) => {
    employeeIds.add(row.employeeId);
    if (row.status !== 'absent') {
      checkedInCount += 1;
    }
    if (row.status === 'checked_out') {
      checkedOutCount += 1;
    }
    if (row.isLateCheckIn || String(row.shiftStatus || '').includes('late')) {
      lateCount += 1;
    }
    if (row.isEarlyCheckOut) {
      earlyLeaveCount += 1;
    }
  });

  return {
    totalRows: rows.length,
    employeeCount: employeeIds.size,
    checkedInCount,
    checkedOutCount,
    lateCount,
    earlyLeaveCount,
  };
};

const aggregateDashboardDayStats = (rows) => {
  const summary = buildOverviewSummary(rows);
  let onTimeCount = 0;
  const byBranchMap = new Map();
  const byMethodMap = new Map();

  rows.forEach((row) => {
    if (
      row.status !== 'absent' &&
      !row.isLateCheckIn &&
      !row.isEarlyCheckOut
    ) {
      onTimeCount += 1;
    }

    const branchId = row.branchId || '';
    const branchName = row.branchName || 'Unassigned';
    const branchKey = branchId || branchName;
    const branchBucket = byBranchMap.get(branchKey) || {
      branchId,
      branchName,
      present: 0,
      absent: 0,
      completed: 0,
    };

    if (row.status === 'absent') {
      branchBucket.absent += 1;
    } else if (row.status === 'checked_out') {
      branchBucket.completed += 1;
      branchBucket.present += 1;
    } else {
      branchBucket.present += 1;
    }
    byBranchMap.set(branchKey, branchBucket);

    if (row.status !== 'absent') {
      const method = row.checkInMethod || 'unknown';
      byMethodMap.set(method, (byMethodMap.get(method) || 0) + 1);
    }
  });

  const byBranch = [...byBranchMap.values()].sort((a, b) =>
    a.branchName.localeCompare(b.branchName)
  );
  const byMethod = [...byMethodMap.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count);

  return {
    summary: {
      ...summary,
      onTimeCount,
    },
    byBranch,
    byMethod,
  };
};

const buildOverviewRows = async ({
  dateKeys,
  includeInactive = false,
  branchFilter = '',
  search = '',
  restrictToEmployeeId = null,
}) => {
  const employeeFilter = { accountRole: 'employee' };
  if (!includeInactive) {
    employeeFilter.isActive = true;
  }

  let employees = await User.find(employeeFilter).sort({ name: 1 });

  if (restrictToEmployeeId) {
    employees = employees.filter(
      (employee) => employee._id === restrictToEmployeeId
    );
  }

  if (search?.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    employees = employees.filter(
      (employee) =>
        regex.test(employee.name) ||
        regex.test(employee._id) ||
        regex.test(employee.phone || '')
    );
  }

  if (dateKeys.length === 0) {
    return [];
  }

  const start = dateKeys[0];
  const end = dateKeys[dateKeys.length - 1];
  const userIds = employees.map((employee) => employee._id);
  const records = await AttendanceRecord.find({
    userId: { $in: userIds },
    dateKey: { $gte: start, $lte: end },
  });

  const recordByUserAndDate = new Map(
    records.map((record) => [`${record.userId}_${record.dateKey}`, record])
  );

  const branchIds = employees.map((employee) => employee.branchId).filter(Boolean);
  records.forEach((record) => {
    if (record.branchId) {
      branchIds.push(record.branchId);
    }
  });
  const branchMap = await loadBranchMap(branchIds);

  const normalizedBranchFilter = branchFilter?.trim() || '';
  const rows = [];

  dateKeys.forEach((dateKey) => {
    employees.forEach((employee) => {
      const record = recordByUserAndDate.get(`${employee._id}_${dateKey}`);
      const rowBranchId = record?.branchId || employee.branchId || '';
      const rowBranchName = record?.branchName || employee.branchName || '';

      if (normalizedBranchFilter && rowBranchId !== normalizedBranchFilter) {
        return;
      }

      const branch = branchMap.get(rowBranchId) || null;
      const rowFields = buildOverviewRowFields(record, branch);

      rows.push({
        employeeId: employee._id,
        name: employee.name,
        phone: employee.phone || '',
        branchId: rowBranchId,
        branchName: rowBranchName,
        isActive: employee.isActive,
        dateKey,
        ...rowFields,
      });
    });
  });

  return rows;
};

module.exports = {
  dateKeyFor,
  parseDateKey,
  formatDateKeyFromDate,
  listDateKeysInRange,
  loadBranchMap,
  buildOverviewRowFields,
  buildOverviewSummary,
  aggregateDashboardDayStats,
  buildOverviewRows,
};
