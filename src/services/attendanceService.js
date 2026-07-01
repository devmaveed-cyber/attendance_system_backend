const AttendanceRecord = require('../models/AttendanceRecord');
const Branch = require('../models/Branch');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const {
  distanceMeters,
  formatDistance,
  isInsideBranchGeofence,
} = require('../utils/geofence');
const { sanitizeAttendanceRecord } = require('../utils/userPresenter');
const { buildPaginationMeta } = require('../utils/paginationUtils');
const { MAX_ALLOWED_ACCURACY_METERS, ALLOW_PAST_DATE_ATTENDANCE } = require('../constants/attendanceConstants');
const { evaluateShiftStatus } = require('../utils/shiftUtils');
const {
  dateKeyFor,
  listDateKeysInRange,
  buildOverviewSummary,
  buildOverviewRows,
} = require('../utils/attendanceOverviewBuilder');
const { scheduleDayRebuild } = require('./dashboardStatsService');
const branchService = require('./branchService');
const nfcTagService = require('./nfcTagService');
const deviceBindingService = require('./deviceBindingService');

const buildRecordId = (userId, dateKey) => `${userId}_${dateKey}`;

const buildSessionId = (userId, dateKey, sessionIndex) =>
  `${userId}_${dateKey}_${sessionIndex}`;

const triggerDashboardDayRebuild = (dateKey) => {
  scheduleDayRebuild(dateKey);
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

// Returns the list of allowed branch IDs for an employee.
// Falls back to single branchId for employees who haven't been updated yet.
const resolveAllowedBranchIds = (employee) => {
  if (employee.allowedBranchIds && employee.allowedBranchIds.length > 0) {
    return employee.allowedBranchIds;
  }

  if (employee.branchId?.trim()) {
    return [employee.branchId];
  }

  return [];
};

const resolveEmployeeForMarking = async (userId) => {
  const employee = await resolveEmployee(userId);
  const allowed = resolveAllowedBranchIds(employee);

  if (allowed.length === 0) {
    throw new ApiError(
      400,
      'No branch assigned to your account. Ask your manager to assign one.'
    );
  }

  return employee;
};

const validateGeofence = ({ latitude, longitude, branch }) => {
  const inside = isInsideBranchGeofence({
    userLat: latitude,
    userLng: longitude,
    branch,
  });

  if (inside) {
    return;
  }

  const geofenceType = branch.geofenceType || 'circle';
  if (geofenceType === 'polygon') {
    throw new ApiError(
      400,
      'You are outside the branch boundary. Move inside the marked area to mark attendance.'
    );
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

// Returns the last open session (checkInAt set, checkOutAt null), or null.
const getActiveSession = (record) => {
  if (!record || !record.sessions || record.sessions.length === 0) {
    return null;
  }

  for (let i = record.sessions.length - 1; i >= 0; i--) {
    if (record.sessions[i].checkInAt && !record.sessions[i].checkOutAt) {
      return { session: record.sessions[i], index: i };
    }
  }

  return null;
};

// Checks if a record has any attendance data (legacy or sessions).
const recordHasAnyCheckIn = (record) => {
  if (!record) return false;
  if (record.sessions && record.sessions.length > 0) return true;
  return Boolean(record.checkInAt);
};

const markAttendanceNfc = async (
  requester,
  {
    type,
    tagUid,
    nfcTagId,
    latitude,
    longitude,
    accuracy,
    dateKey,
    deviceId,
    deviceName,
    platform,
  }
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

  if (!tag.branchId?.trim()) {
    throw new ApiError(
      400,
      'This NFC tag is not assigned to a branch yet. Assign a branch before use.'
    );
  }

  const employee = await resolveEmployeeForMarking(requester._id);
  await deviceBindingService.enforceDeviceBinding(employee, {
    deviceId,
    deviceName,
    platform,
  });

  const branch = await branchService.resolveActiveBranch(tag.branchId);

  // Validate employee is allowed to use this branch.
  const allowedBranchIds = resolveAllowedBranchIds(employee);
  if (!allowedBranchIds.includes(branch._id)) {
    throw new ApiError(
      403,
      `This branch (${branch.name}) is not in your assigned branches. Ask your manager to update your branch list.`
    );
  }

  validateGeofence({ latitude, longitude, branch });

  const resolvedDateKey = resolveAttendanceDateKey(dateKey);
  const recordId = buildRecordId(employee._id, resolvedDateKey);

  const record = await markSessionForEmployee(employee, branch, recordId, resolvedDateKey, {
    type,
    latitude,
    longitude,
    accuracy,
    markMethod: 'nfc',
    tagUid: tag.tagUid,
  });

  await nfcTagService.touchLastScanned(tag._id);

  return enrichAttendanceRecord(record, branch);
};

// Core session-based attendance marking.
const markSessionForEmployee = async (
  employee,
  branch,
  recordId,
  resolvedDateKey,
  { type, latitude, longitude, accuracy, markMethod, tagUid }
) => {
  const now = new Date();
  const markLat = latitude ?? branch.latitude;
  const markLng = longitude ?? branch.longitude;

  let record = await AttendanceRecord.findById(recordId);

  if (type === 'checkIn') {
    const activeResult = getActiveSession(record);

    if (activeResult) {
      const activeSession = activeResult.session;

      if (activeSession.branchId === branch._id) {
        throw new ApiError(400, `Already checked in at ${branch.name}. Check out first.`);
      }

      // Auto-close the open session at a different branch.
      record.sessions[activeResult.index].checkOutAt = now;
      record.sessions[activeResult.index].checkOutLat = markLat;
      record.sessions[activeResult.index].checkOutLng = markLng;
      record.sessions[activeResult.index].checkOutAccuracy = accuracy;
      record.sessions[activeResult.index].checkOutMethod = markMethod;
      if (tagUid) {
        record.sessions[activeResult.index].checkOutNfcUid = tagUid;
      }
    }

    const sessionIndex = record ? record.sessions.length + 1 : 1;
    const newSession = {
      sessionId: buildSessionId(employee._id, resolvedDateKey, sessionIndex),
      branchId: branch._id,
      branchName: branch.name,
      checkInAt: now,
      checkInLat: markLat,
      checkInLng: markLng,
      checkInAccuracy: accuracy,
      checkInMethod: markMethod,
      checkInNfcUid: tagUid || undefined,
    };

    if (record) {
      record.sessions.push(newSession);
      await record.save();
    } else {
      record = await AttendanceRecord.findByIdAndUpdate(
        recordId,
        {
          recordId,
          userId: employee._id,
          userName: employee.name,
          branchId: branch._id,
          branchName: branch.name,
          dateKey: resolvedDateKey,
          sessions: [newSession],
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    triggerDashboardDayRebuild(resolvedDateKey);
    return sanitizeAttendanceRecord(record);
  }

  // type === 'checkOut'
  const activeResult = getActiveSession(record);

  // Handle legacy records (no sessions array).
  if (!activeResult && record && record.checkInAt && !record.checkOutAt) {
    record.checkOutAt = now;
    record.checkOutLat = markLat;
    record.checkOutLng = markLng;
    record.checkOutAccuracy = accuracy;
    record.checkOutMethod = markMethod;
    record.checkOutNfcUid = tagUid || undefined;
    await record.save();
    triggerDashboardDayRebuild(resolvedDateKey);
    return sanitizeAttendanceRecord(record);
  }

  if (!activeResult) {
    throw new ApiError(400, 'Check in first before checking out');
  }

  record.sessions[activeResult.index].checkOutAt = now;
  record.sessions[activeResult.index].checkOutLat = markLat;
  record.sessions[activeResult.index].checkOutLng = markLng;
  record.sessions[activeResult.index].checkOutAccuracy = accuracy;
  record.sessions[activeResult.index].checkOutMethod = markMethod;
  if (tagUid) {
    record.sessions[activeResult.index].checkOutNfcUid = tagUid;
  }

  await record.save();
  triggerDashboardDayRebuild(resolvedDateKey);
  return sanitizeAttendanceRecord(record);
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

  // For shift evaluation use the first session's branch (or legacy branchId).
  const primaryBranchId = record.sessions?.length > 0
    ? record.sessions[0].branchId
    : (record.branchId || employee.branchId);
  const branch = await Branch.findById(primaryBranchId);
  return enrichAttendanceRecord(record, branch);
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

  return employee;
};

const matchesOverviewStatusFilter = (row, statusFilter) => {
  switch (statusFilter) {
    case 'checked_in':
      return row.status !== 'absent';
    case 'checked_out':
      return row.status === 'checked_out';
    default:
      return true;
  }
};

const getOverview = async (
  requester,
  {
    date,
    startDate,
    endDate,
    branchId,
    search,
    statusFilter,
    includeInactive = false,
    page = 1,
    limit = 25,
  }
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

  const restrictToEmployeeId =
    requester.accountRole === 'employee' ? requester._id : null;

  const rows = await buildOverviewRows({
    dateKeys,
    includeInactive,
    branchFilter: branchId,
    search,
    restrictToEmployeeId,
  });

  const branchOptionsMap = new Map();
  rows.forEach((row) => {
    if (row.branchId && !branchOptionsMap.has(row.branchId)) {
      branchOptionsMap.set(row.branchId, {
        branchId: row.branchId,
        name: row.branchName || row.branchId,
      });
    }
  });

  const summary = buildOverviewSummary(rows);
  const normalizedStatusFilter = statusFilter?.trim() || '';
  const filteredRows = normalizedStatusFilter
    ? rows.filter((row) =>
        matchesOverviewStatusFilter(row, normalizedStatusFilter)
      )
    : rows;
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const skip = (safePage - 1) * safeLimit;
  const paginatedRows = filteredRows.slice(skip, skip + safeLimit);

  return {
    startDate: start,
    endDate: end,
    date: start,
    employeeCount: summary.employeeCount,
    count: filteredRows.length,
    summary,
    statusFilter: normalizedStatusFilter || null,
    branches: [...branchOptionsMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    rows: paginatedRows,
    pagination: buildPaginationMeta({
      page: safePage,
      limit: safeLimit,
      total: filteredRows.length,
    }),
  };
};

// Correct or add a session for an employee (admin only).
// sessionIndex: 0-based index. If not provided, corrects the first/only session.
// To add a new manual session, pass sessionIndex = -1 or omit with addNew: true.
const correctAttendance = async (
  admin,
  { employeeId, dateKey, checkInAt, checkOutAt, reason, sessionIndex, branchId: overrideBranchId, addNewSession }
) => {
  if (admin.accountRole !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }

  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    throw new ApiError(400, 'A correction reason of at least 3 characters is required');
  }

  const employee = await resolveAdminEmployee(employeeId);
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

  if (parsedCheckIn && parsedCheckOut && parsedCheckOut <= parsedCheckIn) {
    throw new ApiError(400, 'checkOutAt must be after checkInAt');
  }

  // Determine which branch to use for this correction.
  let branch = null;
  const branchIdToUse = overrideBranchId?.trim() || employee.branchId?.trim();
  if (branchIdToUse) {
    try {
      branch = await branchService.resolveActiveBranch(branchIdToUse);
    } catch {
      // Branch lookup failed — proceed without branch for manual corrections.
    }
  }

  const correctionMeta = {
    correctedBy: admin._id,
    correctedByName: admin.name,
    correctionReason: trimmedReason,
    correctedAt: new Date(),
  };

  // Case: adding a brand new session manually.
  if (addNewSession) {
    if (!parsedCheckIn) {
      throw new ApiError(400, 'checkInAt is required when adding a new session');
    }

    const sessionBranch = branch || { _id: branchIdToUse || 'manual', name: 'Manual' };
    const newSession = {
      sessionId: buildSessionId(
        employee._id,
        resolvedDateKey,
        (existing?.sessions?.length || 0) + 1
      ),
      branchId: sessionBranch._id,
      branchName: sessionBranch.name,
      checkInAt: parsedCheckIn,
      checkOutAt: parsedCheckOut || undefined,
      checkInMethod: 'manual',
      checkOutMethod: parsedCheckOut ? 'manual' : undefined,
    };

    if (existing) {
      existing.sessions.push(newSession);
      Object.assign(existing, correctionMeta);
      await existing.save();
      triggerDashboardDayRebuild(resolvedDateKey);
      return enrichAttendanceRecord(existing, branch);
    }

    const record = await AttendanceRecord.findByIdAndUpdate(
      recordId,
      {
        recordId,
        userId: employee._id,
        userName: employee.name,
        branchId: sessionBranch._id,
        branchName: sessionBranch.name,
        dateKey: resolvedDateKey,
        sessions: [newSession],
        ...correctionMeta,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    triggerDashboardDayRebuild(resolvedDateKey);
    return enrichAttendanceRecord(record, branch);
  }

  // Correct an existing record.
  // If existing record uses sessions, correct that specific session.
  if (existing && existing.sessions && existing.sessions.length > 0) {
    const targetIdx = sessionIndex !== undefined ? Number(sessionIndex) : 0;

    if (targetIdx < 0 || targetIdx >= existing.sessions.length) {
      throw new ApiError(400, `Session index ${targetIdx} does not exist`);
    }

    const session = existing.sessions[targetIdx];
    if (parsedCheckIn !== undefined) {
      session.checkInAt = parsedCheckIn;
      session.checkInMethod = 'manual';
    }
    if (parsedCheckOut !== undefined) {
      session.checkOutAt = parsedCheckOut;
      session.checkOutMethod = parsedCheckOut ? 'manual' : undefined;
    }
    existing.sessions[targetIdx] = session;
    Object.assign(existing, correctionMeta);
    await existing.save();
    triggerDashboardDayRebuild(resolvedDateKey);
    return enrichAttendanceRecord(existing, branch);
  }

  // Legacy record correction (no sessions array).
  const finalCheckIn =
    parsedCheckIn !== undefined ? parsedCheckIn : existing?.checkInAt ?? null;
  const finalCheckOut =
    parsedCheckOut !== undefined ? parsedCheckOut : existing?.checkOutAt ?? null;

  if (!finalCheckIn && finalCheckOut) {
    throw new ApiError(400, 'checkInAt is required before setting checkOutAt');
  }

  if (!finalCheckIn && !finalCheckOut) {
    if (existing) {
      await AttendanceRecord.deleteOne({ _id: recordId });
    }
    triggerDashboardDayRebuild(resolvedDateKey);
    return null;
  }

  const sessionBranch = branch || { _id: employee.branchId || 'manual', name: employee.branchName || 'Manual' };

  const update = {
    recordId,
    userId: employee._id,
    userName: employee.name,
    branchId: sessionBranch._id,
    branchName: sessionBranch.name,
    dateKey: resolvedDateKey,
    ...correctionMeta,
  };

  if (parsedCheckIn !== undefined) {
    update.checkInAt = parsedCheckIn;
    update.checkInMethod = parsedCheckIn ? 'manual' : undefined;
  }

  if (parsedCheckOut !== undefined) {
    update.checkOutAt = parsedCheckOut;
    update.checkOutMethod = parsedCheckOut ? 'manual' : undefined;
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

  triggerDashboardDayRebuild(resolvedDateKey);
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
  triggerDashboardDayRebuild(resolvedDateKey);
  return { employeeId, dateKey: resolvedDateKey, reason: trimmedReason };
};

module.exports = {
  markAttendanceNfc,
  getTodayRecord,
  getOverview,
  correctAttendance,
  clearAttendance,
  resolveAllowedBranchIds,
  getActiveSession,
  recordHasAnyCheckIn,
};
