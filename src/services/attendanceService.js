const AttendanceRecord = require('../models/AttendanceRecord');
const Branch = require('../models/Branch');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const {
  distanceMeters,
  formatDistance,
  isInsideGeofence,
} = require('../utils/geofence');
const { sanitizeAttendanceRecord } = require('../utils/userPresenter');
const { MAX_ALLOWED_ACCURACY_METERS, ALLOW_PAST_DATE_ATTENDANCE } = require('../constants/attendanceConstants');
const { evaluateShiftStatus } = require('../utils/shiftUtils');
const branchService = require('./branchService');
const nfcTagService = require('./nfcTagService');

const buildRecordId = (userId, dateKey) => `${userId}_${dateKey}`;

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

const resolveAttendanceDateKey = (dateKey) => {
  const resolved = dateKey?.trim() || dateKeyFor();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolved)) {
    throw new ApiError(400, 'dateKey must be YYYY-MM-DD');
  }

  const today = dateKeyFor();
  if (resolved > today) {
    throw new ApiError(400, 'Attendance cannot be marked for a future date');
  }

  if (!ALLOW_PAST_DATE_ATTENDANCE && resolved !== today) {
    throw new ApiError(400, 'Attendance can only be marked for today');
  }

  return resolved;
};

const resolveEmployee = async (userId) => {
  const employee = await User.findById(userId);

  if (!employee || employee.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employee accounts can mark attendance');
  }

  if (!employee.isActive) {
    throw new ApiError(403, 'Account is disabled');
  }

  return employee;
};

const resolveEmployeeForMarking = async (userId) => {
  const employee = await resolveEmployee(userId);

  if (!employee.branchId?.trim()) {
    throw new ApiError(
      400,
      'No branch assigned to your account. Ask your manager to assign one.'
    );
  }

  return employee;
};

const validateGeofence = ({ latitude, longitude, branch }) => {
  const inside = isInsideGeofence({
    userLat: latitude,
    userLng: longitude,
    branchLat: branch.latitude,
    branchLng: branch.longitude,
    radiusMeters: branch.radiusMeters,
  });

  if (inside) {
    return;
  }

  const dist = distanceMeters({
    lat1: latitude,
    lng1: longitude,
    lat2: branch.latitude,
    lng2: branch.longitude,
  });

  throw new ApiError(
    400,
    `You are outside the branch area (${formatDistance(dist)} away, allowed ${Math.round(branch.radiusMeters)} m). Move inside to mark attendance.`
  );
};

const markAttendanceForEmployee = async (
  employeeId,
  {
    type,
    latitude,
    longitude,
    accuracy,
    skipGeofence = false,
    branchOverride = null,
    markMethod = 'gps',
    tagUid = null,
    dateKey = null,
  }
) => {
  const employee = branchOverride
    ? await resolveEmployee(employeeId)
    : await resolveEmployeeForMarking(employeeId);
  const branch =
    branchOverride ?? (await branchService.resolveActiveBranch(employee.branchId));

  if (!skipGeofence) {
    if (latitude === undefined || longitude === undefined) {
      throw new ApiError(400, 'latitude and longitude are required');
    }

    if (
      accuracy !== undefined &&
      accuracy !== null &&
      accuracy > MAX_ALLOWED_ACCURACY_METERS
    ) {
      throw new ApiError(
        400,
        `GPS accuracy is too low (${Math.round(accuracy)} m). Try again in open sky.`
      );
    }

    validateGeofence({ latitude, longitude, branch });
  }

  const markLat = latitude ?? branch.latitude;
  const markLng = longitude ?? branch.longitude;

  const resolvedDateKey = resolveAttendanceDateKey(dateKey);
  const recordId = buildRecordId(employee._id, resolvedDateKey);
  const existing = await AttendanceRecord.findById(recordId);

  if (type === 'checkIn') {
    if (existing?.checkInAt) {
      throw new ApiError(400, 'Employee has already checked in for this date');
    }

    const record = await AttendanceRecord.findByIdAndUpdate(
      recordId,
      {
        recordId,
        userId: employee._id,
        userName: employee.name,
        branchId: branch._id,
        branchName: branch.name,
        dateKey: resolvedDateKey,
        checkInAt: new Date(),
        checkInLat: markLat,
        checkInLng: markLng,
        checkInAccuracy: accuracy,
        checkInMethod: markMethod,
        checkInNfcUid: tagUid || undefined,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return sanitizeAttendanceRecord(record);
  }

  if (!existing?.checkInAt) {
    throw new ApiError(400, 'Check in first before checking out');
  }

  if (existing.checkOutAt) {
    throw new ApiError(400, 'Employee has already checked out for this date');
  }

  existing.checkOutAt = new Date();
  existing.checkOutLat = markLat;
  existing.checkOutLng = markLng;
  existing.checkOutAccuracy = accuracy;
  existing.checkOutMethod = markMethod;
  existing.checkOutNfcUid = tagUid || undefined;
  await existing.save();

  return sanitizeAttendanceRecord(existing);
};

const markAttendanceNfc = async (
  requester,
  { type, tagUid, nfcTagId, latitude, longitude, accuracy, dateKey }
) => {
  if (requester.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employee accounts can mark their own attendance');
  }

  if (latitude === undefined || longitude === undefined) {
    throw new ApiError(400, 'latitude and longitude are required');
  }

  if (
    accuracy !== undefined &&
    accuracy !== null &&
    accuracy > MAX_ALLOWED_ACCURACY_METERS
  ) {
    throw new ApiError(
      400,
      `GPS accuracy is too low (${Math.round(accuracy)} m). Try again in open sky.`
    );
  }

  const tag = await nfcTagService.resolveActiveNfcTag({ nfcTagId, tagUid });
  const employee = await resolveEmployeeForMarking(requester._id);

  if (tag.branchId !== employee.branchId) {
    throw new ApiError(
      400,
      'This NFC tag is not registered for your assigned branch.'
    );
  }

  const branch = await branchService.resolveActiveBranch(tag.branchId);
  validateGeofence({ latitude, longitude, branch });

  const record = await markAttendanceForEmployee(requester._id, {
    type,
    latitude,
    longitude,
    accuracy,
    skipGeofence: true,
    branchOverride: branch,
    markMethod: 'nfc',
    tagUid: tag.tagUid,
    dateKey: resolveAttendanceDateKey(dateKey),
  });

  await nfcTagService.touchLastScanned(tag._id);

  const enrichedBranch = branchOverride ?? branch;
  return enrichAttendanceRecord(record, enrichedBranch);
};

const getTodayRecord = async (requester, employeeId) => {
  let targetEmployeeId = requester._id;

  if (requester.accountRole === 'admin') {
    if (!employeeId) {
      throw new ApiError(400, 'employeeId query parameter is required');
    }
    targetEmployeeId = employeeId;
  } else if (employeeId && employeeId !== requester._id) {
    throw new ApiError(403, 'Employees can only view their own attendance');
  }

  const employee = await resolveEmployee(targetEmployeeId);
  const recordId = buildRecordId(employee._id, dateKeyFor());
  const record = await AttendanceRecord.findById(recordId);

  if (!record) {
    return null;
  }

  const branch = await Branch.findById(record.branchId || employee.branchId);
  return enrichAttendanceRecord(record, branch);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const deriveStatus = (record) => {
  if (!record?.checkInAt) {
    return 'absent';
  }
  if (!record.checkOutAt) {
    return 'checked_in';
  }
  return 'checked_out';
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

const enrichAttendanceRecord = (record, branch) => {
  const sanitized = sanitizeAttendanceRecord(record);
  const shift = evaluateShiftStatus(record, branch);

  return {
    ...sanitized,
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

const parseOptionalIsoDate = (value, label) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `${label} must be a valid ISO date-time`);
  }

  return parsed;
};

const resolveAdminEmployee = async (employeeId) => {
  const employee = await User.findById(employeeId);

  if (!employee || employee.accountRole !== 'employee') {
    throw new ApiError(404, 'Employee not found');
  }

  if (!employee.branchId?.trim()) {
    throw new ApiError(
      400,
      'Employee has no branch assigned. Assign a branch before correcting attendance.'
    );
  }

  return employee;
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

const getOverview = async (
  requester,
  { date, startDate, endDate, branchId, search, includeInactive = false }
) => {
  const today = dateKeyFor();
  let start = startDate?.trim() || date?.trim() || today;
  let end = endDate?.trim() || date?.trim() || start;

  if (start > end) {
    throw new ApiError(400, 'startDate cannot be after endDate');
  }

  const dateKeys = listDateKeysInRange(start, end);
  if (dateKeys.length > 366) {
    throw new ApiError(400, 'Date range cannot exceed 366 days');
  }

  const employeeFilter = { accountRole: 'employee' };
  if (!includeInactive) {
    employeeFilter.isActive = true;
  }

  let employees = await User.find(employeeFilter).sort({ name: 1 });

  if (requester.accountRole === 'employee') {
    employees = employees.filter((employee) => employee._id === requester._id);
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

  const userIds = employees.map((employee) => employee._id);
  const records = await AttendanceRecord.find({
    userId: { $in: userIds },
    dateKey: { $gte: start, $lte: end },
  });
  const recordByUserAndDate = new Map(
    records.map((record) => [`${record.userId}_${record.dateKey}`, record])
  );

  const branchFilter = branchId?.trim() || '';
  const branchIds = employees.map((employee) => employee.branchId).filter(Boolean);
  records.forEach((record) => {
    if (record.branchId) {
      branchIds.push(record.branchId);
    }
  });
  const branchMap = await loadBranchMap(branchIds);

  const rows = [];
  dateKeys.forEach((dateKey) => {
    employees.forEach((employee) => {
      const record = recordByUserAndDate.get(`${employee._id}_${dateKey}`);
      const rowBranchId = record?.branchId || employee.branchId || '';
      const rowBranchName = record?.branchName || employee.branchName || '';

      if (branchFilter && rowBranchId !== branchFilter) {
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

  const branchOptionsMap = new Map();
  dateKeys.forEach((dateKey) => {
    employees.forEach((employee) => {
      const record = recordByUserAndDate.get(`${employee._id}_${dateKey}`);
      const rowBranchId = record?.branchId || employee.branchId || '';
      const rowBranchName = record?.branchName || employee.branchName || '';
      if (rowBranchId && !branchOptionsMap.has(rowBranchId)) {
        branchOptionsMap.set(rowBranchId, {
          branchId: rowBranchId,
          name: rowBranchName || rowBranchId,
        });
      }
    });
  });

  const uniqueEmployeeIds = new Set(rows.map((row) => row.employeeId));

  return {
    startDate: start,
    endDate: end,
    date: start,
    employeeCount: uniqueEmployeeIds.size,
    count: rows.length,
    branches: [...branchOptionsMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    rows,
  };
};

const correctAttendance = async (
  admin,
  { employeeId, dateKey, checkInAt, checkOutAt, reason }
) => {
  if (admin.accountRole !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }

  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    throw new ApiError(400, 'A correction reason of at least 3 characters is required');
  }

  const employee = await resolveAdminEmployee(employeeId);
  const branch = await branchService.resolveActiveBranch(employee.branchId);
  const resolvedDateKey = resolveAttendanceDateKey(dateKey);
  const recordId = buildRecordId(employee._id, resolvedDateKey);
  const existing = await AttendanceRecord.findById(recordId);

  const parsedCheckIn = parseOptionalIsoDate(checkInAt, 'checkInAt');
  const parsedCheckOut = parseOptionalIsoDate(checkOutAt, 'checkOutAt');

  if (parsedCheckIn === undefined && parsedCheckOut === undefined) {
    throw new ApiError(
      400,
      'Provide at least one of checkInAt or checkOutAt to correct attendance'
    );
  }

  if (!existing && parsedCheckIn === null) {
    throw new ApiError(
      400,
      'checkInAt is required when creating a new attendance record'
    );
  }

  const finalCheckIn =
    parsedCheckIn !== undefined ? parsedCheckIn : existing?.checkInAt ?? null;
  const finalCheckOut =
    parsedCheckOut !== undefined ? parsedCheckOut : existing?.checkOutAt ?? null;

  if (finalCheckIn && finalCheckOut && finalCheckOut <= finalCheckIn) {
    throw new ApiError(400, 'checkOutAt must be after checkInAt');
  }

  if (!finalCheckIn && finalCheckOut) {
    throw new ApiError(400, 'checkInAt is required before setting checkOutAt');
  }

  if (!finalCheckIn && !finalCheckOut) {
    if (existing) {
      await AttendanceRecord.deleteOne({ _id: recordId });
    }
    return null;
  }

  const update = {
    recordId,
    userId: employee._id,
    userName: employee.name,
    branchId: branch._id,
    branchName: branch.name,
    dateKey: resolvedDateKey,
    correctedBy: admin._id,
    correctedByName: admin.name,
    correctionReason: trimmedReason,
    correctedAt: new Date(),
  };

  if (parsedCheckIn !== undefined) {
    update.checkInAt = parsedCheckIn;
    update.checkInMethod = parsedCheckIn ? 'manual' : undefined;
    if (parsedCheckIn) {
      update.checkInLat = undefined;
      update.checkInLng = undefined;
      update.checkInAccuracy = undefined;
      update.checkInNfcUid = undefined;
    }
  }

  if (parsedCheckOut !== undefined) {
    update.checkOutAt = parsedCheckOut;
    update.checkOutMethod = parsedCheckOut ? 'manual' : undefined;
    if (parsedCheckOut) {
      update.checkOutLat = undefined;
      update.checkOutLng = undefined;
      update.checkOutAccuracy = undefined;
      update.checkOutNfcUid = undefined;
    }
  }

  const record = await AttendanceRecord.findByIdAndUpdate(
    recordId,
    update,
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return enrichAttendanceRecord(record, branch);
};

const clearAttendance = async (admin, { employeeId, dateKey, reason }) => {
  if (admin.accountRole !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }

  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    throw new ApiError(400, 'A reason of at least 3 characters is required');
  }

  await resolveAdminEmployee(employeeId);
  const resolvedDateKey = resolveAttendanceDateKey(dateKey);
  const recordId = buildRecordId(employeeId, resolvedDateKey);
  const existing = await AttendanceRecord.findById(recordId);

  if (!existing) {
    throw new ApiError(404, 'No attendance record found for this employee and date');
  }

  await AttendanceRecord.deleteOne({ _id: recordId });
  return { employeeId, dateKey: resolvedDateKey, reason: trimmedReason };
};

module.exports = {
  markAttendanceNfc,
  getTodayRecord,
  getOverview,
  correctAttendance,
  clearAttendance,
};
