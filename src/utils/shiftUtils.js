const {
  DEFAULT_SHIFT_START,
  DEFAULT_SHIFT_END,
  DEFAULT_GRACE_MINUTES_LATE,
  UAE_OFFSET_MINUTES,
} = require('../constants/attendanceConstants');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const parseShiftMinutes = (timeValue) => {
  const [hours, minutes] = timeValue.split(':').map(Number);
  return hours * 60 + minutes;
};

const toLocalMinutes = (isoDate, offsetMinutes = UAE_OFFSET_MINUTES) => {
  const date = new Date(isoDate);
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};

const resolveBranchShiftConfig = (branch) => ({
  shiftStartTime: branch?.shiftStartTime || DEFAULT_SHIFT_START,
  shiftEndTime: branch?.shiftEndTime || DEFAULT_SHIFT_END,
  graceMinutesLate:
    branch?.graceMinutesLate ?? DEFAULT_GRACE_MINUTES_LATE,
});

const validateShiftTime = (value, label) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const trimmed = String(value).trim();
  if (!TIME_PATTERN.test(trimmed)) {
    throw new Error(`${label} must be in HH:mm format`);
  }

  return trimmed;
};

const validateShiftRange = (shiftStartTime, shiftEndTime) => {
  if (parseShiftMinutes(shiftStartTime) >= parseShiftMinutes(shiftEndTime)) {
    throw new Error('shiftEndTime must be after shiftStartTime');
  }
};

const evaluateShiftStatus = (record, branch) => {
  const { shiftStartTime, shiftEndTime, graceMinutesLate } =
    resolveBranchShiftConfig(branch);

  const shiftStartMinutes = parseShiftMinutes(shiftStartTime);
  const shiftEndMinutes = parseShiftMinutes(shiftEndTime);
  const lateThresholdMinutes = shiftStartMinutes + graceMinutesLate;

  if (!record?.checkInAt) {
    return {
      status: 'absent',
      shiftStatus: 'absent',
      isLateCheckIn: false,
      isEarlyCheckOut: false,
      minutesLate: null,
      minutesEarlyCheckout: null,
      shiftStartTime,
      shiftEndTime,
      graceMinutesLate,
    };
  }

  const checkInMinutes = toLocalMinutes(record.checkInAt);
  const isLateCheckIn = checkInMinutes > lateThresholdMinutes;
  const minutesLate = isLateCheckIn
    ? Math.max(0, checkInMinutes - shiftStartMinutes)
    : 0;

  if (!record.checkOutAt) {
    return {
      status: 'checked_in',
      shiftStatus: isLateCheckIn ? 'late' : 'on_time',
      isLateCheckIn,
      isEarlyCheckOut: false,
      minutesLate: isLateCheckIn ? minutesLate : null,
      minutesEarlyCheckout: null,
      shiftStartTime,
      shiftEndTime,
      graceMinutesLate,
    };
  }

  const checkOutMinutes = toLocalMinutes(record.checkOutAt);
  const isEarlyCheckOut = checkOutMinutes < shiftEndMinutes;
  const minutesEarlyCheckout = isEarlyCheckOut
    ? Math.max(0, shiftEndMinutes - checkOutMinutes)
    : 0;

  let shiftStatus = 'completed';
  if (isLateCheckIn && isEarlyCheckOut) {
    shiftStatus = 'late_early_leave';
  } else if (isLateCheckIn) {
    shiftStatus = 'late_completed';
  } else if (isEarlyCheckOut) {
    shiftStatus = 'early_leave';
  }

  return {
    status: 'checked_out',
    shiftStatus,
    isLateCheckIn,
    isEarlyCheckOut,
    minutesLate: isLateCheckIn ? minutesLate : null,
    minutesEarlyCheckout: isEarlyCheckOut ? minutesEarlyCheckout : null,
    shiftStartTime,
    shiftEndTime,
    graceMinutesLate,
  };
};

module.exports = {
  TIME_PATTERN,
  parseShiftMinutes,
  toLocalMinutes,
  resolveBranchShiftConfig,
  validateShiftTime,
  validateShiftRange,
  evaluateShiftStatus,
};
