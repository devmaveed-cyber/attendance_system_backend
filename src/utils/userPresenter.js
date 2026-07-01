const sanitizeUser = (user) => ({
  userId: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  groupId: user.groupId,
  groupName: user.groupName,
  branchId: user.branchId,
  branchName: user.branchName,
  allowedBranchIds: user.allowedBranchIds || [],
  empNo: user.empNo || '',
  department: user.department || '',
  jobPosition: user.jobPosition || '',
  workingHours: user.workingHours || '',
  visaExpiryDate: user.visaExpiryDate || null,
  gender: user.gender || '',
  nationality: user.nationality || '',
  instructorPermitNo: user.instructorPermitNo || '',
  company: user.company || '',
  gearType: user.gearType || '',
  instructorLicenseTypes: user.instructorLicenseTypes || '',
  hrCreatedOn: user.hrCreatedOn || null,
  hrCreatedBy: user.hrCreatedBy || '',
  manager: user.manager || '',
  isActive: user.isActive,
  accountRole: user.accountRole,
  boundDevice: {
    deviceId: user.boundDevice?.deviceId || '',
    deviceName: user.boundDevice?.deviceName || '',
    platform: user.boundDevice?.platform || '',
    boundAt: user.boundDevice?.boundAt || null,
  },
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sanitizeEmployee = sanitizeUser;

const sanitizeGroup = (group) => ({
  groupId: group._id,
  name: group.name,
  sections: group.sections,
  isActive: group.isActive,
  isSystem: group.isSystem,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

const sanitizeBranch = (branch) => ({
  branchId: branch._id,
  name: branch.name,
  address: branch.address,
  latitude: branch.latitude,
  longitude: branch.longitude,
  radiusMeters: branch.radiusMeters,
  geofenceType: branch.geofenceType || 'circle',
  boundaryPoints: Array.isArray(branch.boundaryPoints)
    ? branch.boundaryPoints.map((point) => ({
        lat: point.lat,
        lng: point.lng,
      }))
    : [],
  isActive: branch.isActive,
  shiftStartTime: branch.shiftStartTime,
  shiftEndTime: branch.shiftEndTime,
  graceMinutesLate: branch.graceMinutesLate,
  createdAt: branch.createdAt,
  updatedAt: branch.updatedAt,
});

const sanitizeNfcTag = (tag) => ({
  nfcTagId: tag._id,
  branchId: tag.branchId,
  branchName: tag.branchName,
  tagUid: tag.tagUid,
  label: tag.label,
  isActive: tag.isActive,
  lastScannedAt: tag.lastScannedAt,
  createdAt: tag.createdAt,
  updatedAt: tag.updatedAt,
});

const sanitizeAttendanceSession = (session) => ({
  sessionId: session.sessionId,
  branchId: session.branchId,
  branchName: session.branchName,
  checkInAt: session.checkInAt,
  checkOutAt: session.checkOutAt || null,
  checkInLat: session.checkInLat,
  checkInLng: session.checkInLng,
  checkInAccuracy: session.checkInAccuracy,
  checkOutLat: session.checkOutLat,
  checkOutLng: session.checkOutLng,
  checkOutAccuracy: session.checkOutAccuracy,
  checkInMethod: session.checkInMethod,
  checkInNfcUid: session.checkInNfcUid,
  checkOutMethod: session.checkOutMethod,
  checkOutNfcUid: session.checkOutNfcUid,
});

// Derives the effective checkInAt/checkOutAt/branchId from a record for backward compat.
// For new session-based records these come from the sessions array.
const deriveRecordSummary = (record) => {
  const sessions = record.sessions;

  if (!sessions || sessions.length === 0) {
    return {
      checkInAt: record.checkInAt,
      checkOutAt: record.checkOutAt,
      branchId: record.branchId,
      branchName: record.branchName,
      checkInMethod: record.checkInMethod,
      checkOutMethod: record.checkOutMethod,
    };
  }

  const firstSession = sessions[0];
  const lastCompleted = [...sessions].reverse().find((s) => s.checkOutAt);

  return {
    checkInAt: firstSession.checkInAt,
    checkOutAt: lastCompleted?.checkOutAt || null,
    branchId: firstSession.branchId,
    branchName: firstSession.branchName,
    checkInMethod: firstSession.checkInMethod,
    checkOutMethod: lastCompleted?.checkOutMethod || null,
  };
};

const sanitizeAttendanceRecord = (record) => {
  const summary = deriveRecordSummary(record);

  return {
    recordId: record.recordId || record._id,
    userId: record.userId,
    userName: record.userName,
    branchId: summary.branchId,
    branchName: summary.branchName,
    dateKey: record.dateKey,
    checkInAt: summary.checkInAt,
    checkOutAt: summary.checkOutAt,
    checkInLat: record.checkInLat,
    checkInLng: record.checkInLng,
    checkInAccuracy: record.checkInAccuracy,
    checkOutLat: record.checkOutLat,
    checkOutLng: record.checkOutLng,
    checkOutAccuracy: record.checkOutAccuracy,
    checkInMethod: summary.checkInMethod,
    checkInNfcUid: record.checkInNfcUid,
    checkOutMethod: summary.checkOutMethod,
    checkOutNfcUid: record.checkOutNfcUid,
    correctedBy: record.correctedBy,
    correctedByName: record.correctedByName,
    correctionReason: record.correctionReason,
    correctedAt: record.correctedAt,
    isManualCorrected: Boolean(record.correctedAt),
    sessions: Array.isArray(record.sessions)
      ? record.sessions.map(sanitizeAttendanceSession)
      : [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

module.exports = {
  sanitizeUser,
  sanitizeEmployee,
  sanitizeGroup,
  sanitizeBranch,
  sanitizeNfcTag,
  sanitizeAttendanceRecord,
  sanitizeAttendanceSession,
  deriveRecordSummary,
};
