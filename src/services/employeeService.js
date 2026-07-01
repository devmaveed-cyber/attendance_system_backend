const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');
const ApiError = require('../utils/ApiError');
const { sanitizeEmployee } = require('../utils/userPresenter');
const { buildPaginationMeta } = require('../utils/paginationUtils');
const { parseOptionalDate } = require('../utils/employeeImportMapper');
const { assertPhoneAvailable } = require('../utils/userPhone');
const { normalizePhone } = require('../utils/phoneUtils');
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

const createEmployee = async (payload) => {
  const {
    name,
    email,
    password,
    phone,
    branchId,
    empNo,
  } = payload;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, 'An employee with this email already exists');
  }

  const normalizedEmpNo = String(empNo || '').trim();

  if (!normalizedEmpNo) {
    throw new ApiError(400, 'EMP number is required');
  }

  const duplicateEmpNo = await User.findOne({ empNo: normalizedEmpNo });

  if (duplicateEmpNo) {
    throw new ApiError(409, 'An employee with this EMP number already exists');
  }

  // allowedBranchIds can be sent as an array; branchId is backward-compat fallback.
  const allowedBranchIdsRaw = payload.allowedBranchIds;
  let resolvedAllowedBranchIds = [];
  let primaryBranch = null;

  if (Array.isArray(allowedBranchIdsRaw) && allowedBranchIdsRaw.length > 0) {
    for (const bid of allowedBranchIdsRaw) {
      try {
        const b = await branchService.resolveActiveBranch(bid);
        resolvedAllowedBranchIds.push(b._id);
        if (!primaryBranch) primaryBranch = b;
      } catch { /* skip invalid */ }
    }
  }

  // Also handle single branchId for backward compat.
  if (!primaryBranch && branchId) {
    primaryBranch = await branchService.resolveActiveBranch(branchId);
    if (!resolvedAllowedBranchIds.includes(primaryBranch._id)) {
      resolvedAllowedBranchIds = [primaryBranch._id];
    }
  }

  if (!primaryBranch) {
    throw new ApiError(400, 'At least one valid branch is required');
  }

  const normalizedPhone = await assertPhoneAvailable(phone);

  const employee = await User.create({
    name,
    email,
    password,
    phone: normalizedPhone,
    empNo: normalizedEmpNo,
    groupId: '',
    groupName: '',
    branchId: primaryBranch._id,
    branchName: primaryBranch.name,
    allowedBranchIds: resolvedAllowedBranchIds,
    accountRole: 'employee',
  });

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
    const nextPhone = normalizePhone(payload.phone);
    const currentPhone = normalizePhone(employee.phone);
    // Only validate uniqueness when the phone number is actually changing.
    // Re-checking an unchanged number can false-positive if another record
    // shares a formatting variant of the same digits in the database.
    if (nextPhone !== currentPhone) {
      employee.phone = await assertPhoneAvailable(payload.phone, employee._id);
    }
  }

  if (payload.isActive !== undefined) {
    employee.isActive = payload.isActive;
  }

  if (payload.allowedBranchIds !== undefined) {
    const resolved = [];
    let primary = null;

    if (Array.isArray(payload.allowedBranchIds) && payload.allowedBranchIds.length > 0) {
      for (const bid of payload.allowedBranchIds) {
        try {
          const b = await branchService.resolveActiveBranch(bid);
          resolved.push(b._id);
          if (!primary) primary = b;
        } catch { /* skip invalid/inactive branch id */ }
      }

      // Reject if every supplied ID was invalid — do not silently clear branches.
      if (resolved.length === 0) {
        throw new ApiError(
          400,
          'None of the provided allowedBranchIds are valid or active. At least one valid branch is required.'
        );
      }
    } else if (Array.isArray(payload.allowedBranchIds) && payload.allowedBranchIds.length === 0) {
      // Explicitly passing empty array — treat same as removing all branches, block it.
      throw new ApiError(400, 'allowedBranchIds cannot be empty. Assign at least one branch.');
    }

    if (resolved.length > 0) {
      employee.allowedBranchIds = resolved;
    }

    if (primary) {
      employee.branchId = primary._id;
      employee.branchName = primary.name;
    }
  } else if (payload.branchId !== undefined) {
    const branch = await branchService.resolveActiveBranch(payload.branchId);
    employee.branchId = branch._id;
    employee.branchName = branch.name;
    // Keep single branch in allowedBranchIds list too.
    if (!employee.allowedBranchIds?.includes(branch._id)) {
      employee.allowedBranchIds = [branch._id];
    }
  }

  if (payload.password !== undefined) {
    employee.password = payload.password;
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
