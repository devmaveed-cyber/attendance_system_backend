const attendanceService = require('../services/attendanceService');

const markAttendance = async (req, res) => {
  const record = await attendanceService.markAttendance(req.user, req.body);

  res.status(200).json({
    success: true,
    message:
      req.body.type === 'checkIn'
        ? 'Check-in marked successfully'
        : 'Check-out marked successfully',
    data: { record },
  });
};

const markEmployeeAttendance = async (req, res) => {
  const record = await attendanceService.markAttendanceForEmployee(
    req.body.employeeId,
    {
      type: req.body.type,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      accuracy: req.body.accuracy,
      skipGeofence: true,
    }
  );

  res.status(200).json({
    success: true,
    message:
      req.body.type === 'checkIn'
        ? 'Employee check-in marked successfully'
        : 'Employee check-out marked successfully',
    data: { record },
  });
};

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

module.exports = {
  markAttendance,
  markEmployeeAttendance,
  markNfcAttendance,
  getTodayRecord,
  getOverview,
};
