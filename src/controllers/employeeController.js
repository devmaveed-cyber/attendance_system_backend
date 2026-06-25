const employeeService = require('../services/employeeService');
const bulkImportService = require('../services/bulkImportService');
const ApiError = require('../utils/ApiError');

const getEmployees = async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 25;
  const search = req.query.search?.toString() || '';

  const result = await employeeService.getEmployees({ page, limit, search });

  res.status(200).json({
    success: true,
    count: result.employees.length,
    data: {
      employees: result.employees,
      pagination: result.pagination,
    },
  });
};

const createEmployee = async (req, res) => {
  const employee = await employeeService.createEmployee(req.body);

  res.status(201).json({
    success: true,
    message: 'Employee created successfully',
    data: { employee },
  });
};

const updateEmployee = async (req, res) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Employee updated successfully',
    data: { employee },
  });
};

const bulkImportEmployees = async (req, res) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'Excel file is required');
  }

  const summary = await bulkImportService.bulkImportEmployeesFromExcel(
    req.file.buffer
  );

  res.status(200).json({
    success: true,
    message: 'Employee bulk import completed',
    data: { summary },
  });
};

module.exports = {
  getEmployees,
  createEmployee,
  updateEmployee,
  bulkImportEmployees,
};
