const attendanceService = require('../services/attendanceService');

const markNfcAttendance = async (req, res) => {
  const record = await attendanceService.markAttendanceNfc(req.user, req.body);

  res.status(200).json({
    success: true,
    message:
      req.body.type === 'checkIn'
        ? 'Check-in marked successfully'
        : 'Check-out marked successfully',
    data: { record },
  });
};

const getTodayRecord = async (req, res) => {
  const record = await attendanceService.getTodayRecord(
    req.user,
    req.query.employeeId
  );

  res.status(200).json({
    success: true,
    data: { record },
  });
};

const getOverview = async (req, res) => {
  const overview = await attendanceService.getOverview(req.user, req.query);

  res.status(200).json({
    success: true,
    count: overview.count,
    data: { overview },
  });
};

const correctAttendance = async (req, res) => {
  const record = await attendanceService.correctAttendance(req.user, req.body);

  res.status(200).json({
    success: true,
    message: record
      ? 'Attendance corrected successfully'
      : 'Attendance record cleared successfully',
    data: { record },
  });
};

const clearAttendance = async (req, res) => {
  const result = await attendanceService.clearAttendance(req.user, req.body);

  res.status(200).json({
    success: true,
    message: 'Attendance record deleted successfully',
    data: result,
  });
};

module.exports = {
  markNfcAttendance,
  getTodayRecord,
  getOverview,
  correctAttendance,
  clearAttendance,
};
