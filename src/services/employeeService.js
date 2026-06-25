const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sanitizeEmployee } = require('../utils/userPresenter');
const { buildPaginationMeta } = require('../utils/paginationUtils');
const branchService = require('./branchService');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildEmployeeSearchFilter = (search = '') => {
  const filter = { accountRole: 'employee' };
  const normalized = search.trim();

  if (!normalized) {
    return filter;
  }

  const regex = new RegExp(escapeRegex(normalized), 'i');
  filter.$or = [
    { _id: regex },
    { name: regex },
    { email: regex },
    { empNo: regex },
    { phone: regex },
    { branchId: regex },
    { branchName: regex },
    { department: regex },
    { jobPosition: regex },
    { workingHours: regex },
    { gender: regex },
    { nationality: regex },
    { instructorPermitNo: regex },
    { company: regex },
    { gearType: regex },
    { instructorLicenseTypes: regex },
    { hrCreatedBy: regex },
    { manager: regex },
  ];

  return filter;
};

const getEmployees = async ({ page = 1, limit = 25, search = '' } = {}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;
  const filter = buildEmployeeSearchFilter(search);

  const [employees, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
    User.countDocuments(filter),
  ]);

  return {
    employees: employees.map(sanitizeEmployee),
    pagination: buildPaginationMeta({
      page: safePage,
      limit: safeLimit,
      total,
    }),
  };
};

const getAllEmployees = async () => {
  const { employees } = await getEmployees({ page: 1, limit: 100 });
  return employees;
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
  getEmployees,
  getAllEmployees,
  createEmployee,
  updateEmployee,
};
