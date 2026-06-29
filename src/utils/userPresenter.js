const sanitizeUser = (user) => ({
  userId: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  groupId: user.groupId,
  groupName: user.groupName,
  branchId: user.branchId,
  branchName: user.branchName,
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

const sanitizeAttendanceRecord = (record) => ({
  recordId: record.recordId || record._id,
  userId: record.userId,
  userName: record.userName,
  branchId: record.branchId,
  branchName: record.branchName,
  dateKey: record.dateKey,
  checkInAt: record.checkInAt,
  checkOutAt: record.checkOutAt,
  checkInLat: record.checkInLat,
  checkInLng: record.checkInLng,
  checkInAccuracy: record.checkInAccuracy,
  checkOutLat: record.checkOutLat,
  checkOutLng: record.checkOutLng,
  checkOutAccuracy: record.checkOutAccuracy,
  checkInMethod: record.checkInMethod,
  checkInNfcUid: record.checkInNfcUid,
  checkOutMethod: record.checkOutMethod,
  checkOutNfcUid: record.checkOutNfcUid,
  correctedBy: record.correctedBy,
  correctedByName: record.correctedByName,
  correctionReason: record.correctionReason,
  correctedAt: record.correctedAt,
  isManualCorrected: Boolean(record.correctedAt),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

module.exports = {
  sanitizeUser,
  sanitizeEmployee,
  sanitizeGroup,
  sanitizeBranch,
  sanitizeNfcTag,
  sanitizeAttendanceRecord,
};
