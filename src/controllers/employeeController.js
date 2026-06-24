const employeeService = require('../services/employeeService');

const getEmployees = async (_req, res) => {
  const employees = await employeeService.getAllEmployees();

  res.status(200).json({
    success: true,
    count: employees.length,
    data: { employees },
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

module.exports = {
  getEmployees,
  createEmployee,
  updateEmployee,
};
