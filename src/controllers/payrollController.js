const payrollService = require('../services/payrollService');
const ApiError = require('../utils/ApiError');

const getPayrollRecords = async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 25;
  const search = req.query.search?.toString() || '';

  const result = await payrollService.getPayrollRecords({ page, limit, search });

  res.status(200).json({
    success: true,
    count: result.records.length,
    data: {
      records: result.records,
      pagination: result.pagination,
    },
  });
};

const getMyPayrollRecords = async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 25;
  const empNo = req.user?.empNo?.trim();

  if (!empNo) {
    throw new ApiError(400, 'Your account has no EMP number assigned');
  }

  const result = await payrollService.getPayrollRecordsForEmployee({
    empNo,
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    count: result.records.length,
    data: {
      records: result.records,
      pagination: result.pagination,
    },
  });
};

const createPayrollRecord = async (req, res) => {
  const record = await payrollService.createPayrollRecord(req.body);

  res.status(201).json({
    success: true,
    message: 'Payroll record created successfully',
    data: { record },
  });
};

const updatePayrollRecord = async (req, res) => {
  const record = await payrollService.updatePayrollRecord(
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    message: 'Payroll record updated successfully',
    data: { record },
  });
};

const deletePayrollRecord = async (req, res) => {
  const result = await payrollService.deletePayrollRecord(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Payroll record deleted successfully',
    data: result,
  });
};

const bulkImportPayroll = async (req, res) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'Excel file is required');
  }

  const summary = await payrollService.bulkImportPayrollFromExcel(
    req.file.buffer
  );

  res.status(200).json({
    success: true,
    message: 'Payroll bulk import completed',
    data: { summary },
  });
};

module.exports = {
  getPayrollRecords,
  getMyPayrollRecords,
  createPayrollRecord,
  updatePayrollRecord,
  deletePayrollRecord,
  bulkImportPayroll,
};
