const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sanitizeEmployee } = require('../utils/userPresenter');
const branchService = require('./branchService');

const getAllEmployees = async () => {
  const employees = await User.find({ accountRole: 'employee' }).sort({
    createdAt: -1,
  });
  return employees.map(sanitizeEmployee);
};

const createEmployee = async ({
  name,
  email,
  password,
  phone,
  branchId,
}) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, 'An employee with this email already exists');
  }

  const branch = await branchService.resolveActiveBranch(branchId);

  const employee = await User.create({
    name,
    email,
    password,
    phone,
    groupId: '',
    groupName: '',
    branchId: branch._id,
    branchName: branch.name,
    accountRole: 'employee',
  });

  return sanitizeEmployee(employee);
};

const updateEmployee = async (employeeId, payload) => {
  const employee = await User.findOne({
    _id: employeeId,
    accountRole: 'employee',
  });

  if (!employee) {
    throw new ApiError(404, 'Employee not found');
  }

  if (payload.name !== undefined) {
    employee.name = payload.name;
  }

  if (payload.phone !== undefined) {
    employee.phone = payload.phone;
  }

  if (payload.isActive !== undefined) {
    employee.isActive = payload.isActive;
  }

  if (payload.branchId !== undefined) {
    const branch = await branchService.resolveActiveBranch(payload.branchId);
    employee.branchId = branch._id;
    employee.branchName = branch.name;
  }

  if (payload.password !== undefined) {
    employee.password = payload.password;
  }

  await employee.save();
  return sanitizeEmployee(employee);
};

module.exports = {
  getAllEmployees,
  createEmployee,
  updateEmployee,
};
