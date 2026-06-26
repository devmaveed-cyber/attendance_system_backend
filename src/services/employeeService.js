const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');
const ApiError = require('../utils/ApiError');
const { sanitizeEmployee } = require('../utils/userPresenter');
const { buildPaginationMeta } = require('../utils/paginationUtils');
const { parseOptionalDate } = require('../utils/employeeImportMapper');
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

const assignOptionalString = (employee, field, value) => {
  if (value !== undefined) {
    employee[field] = String(value ?? '').trim();
  }
};

const assignOptionalDate = (employee, field, value) => {
  if (value === undefined) return;

  if (value === null || value === '') {
    employee[field] = null;
    return;
  }

  employee[field] = parseOptionalDate(value);
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

  if (payload.empNo !== undefined) {
    const empNo = String(payload.empNo).trim();
    if (empNo) {
      const duplicate = await User.findOne({
        empNo,
        _id: { $ne: employeeId },
      });
      if (duplicate) {
        throw new ApiError(409, 'Another employee already uses this EMP number');
      }
    }
    employee.empNo = empNo;
  }

  assignOptionalString(employee, 'department', payload.department);
  assignOptionalString(employee, 'jobPosition', payload.jobPosition);
  assignOptionalString(employee, 'workingHours', payload.workingHours);
  assignOptionalString(employee, 'gender', payload.gender);
  assignOptionalString(employee, 'nationality', payload.nationality);
  assignOptionalString(employee, 'instructorPermitNo', payload.instructorPermitNo);
  assignOptionalString(employee, 'company', payload.company);
  assignOptionalString(employee, 'gearType', payload.gearType);
  assignOptionalString(employee, 'instructorLicenseTypes', payload.instructorLicenseTypes);
  assignOptionalString(employee, 'hrCreatedBy', payload.hrCreatedBy);
  assignOptionalString(employee, 'manager', payload.manager);
  assignOptionalDate(employee, 'visaExpiryDate', payload.visaExpiryDate);
  assignOptionalDate(employee, 'hrCreatedOn', payload.hrCreatedOn);

  await employee.save();
  return sanitizeEmployee(employee);
};

const deleteEmployee = async (employeeId) => {
  const employee = await User.findOne({
    _id: employeeId,
    accountRole: 'employee',
  });

  if (!employee) {
    throw new ApiError(404, 'Employee not found');
  }

  const attendanceResult = await AttendanceRecord.deleteMany({
    userId: employee._id,
  });

  await User.deleteOne({ _id: employee._id });

  return {
    employeeId: employee._id,
    name: employee.name,
    deletedAttendanceRecords: attendanceResult.deletedCount,
  };
};

module.exports = {
  getEmployees,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
