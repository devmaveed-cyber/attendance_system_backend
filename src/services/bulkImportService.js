const bcrypt = require('bcryptjs');
const Branch = require('../models/Branch');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const {
  DEFAULT_SHIFT_START,
  DEFAULT_SHIFT_END,
  DEFAULT_GRACE_MINUTES_LATE,
} = require('../constants/attendanceConstants');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');
const {
  parseEmployeeWorkbook,
  isEmptyImportRow,
} = require('../utils/excelParser');
const {
  mapExcelRowToEmployeeFields,
  buildImportPassword,
} = require('../utils/employeeImportMapper');

const DEFAULT_IMPORT_LATITUDE = 25.14758;
const DEFAULT_IMPORT_LONGITUDE = 55.241171;
const DEFAULT_IMPORT_RADIUS_METERS = 500;

const normalizeBranchName = (value) =>
  value.trim().replace(/\s+/g, ' ');

const normalizeBranchKey = (value) =>
  normalizeBranchName(value).toLowerCase();

const buildFallbackEmail = (empNo) => `emp${String(empNo).trim()}@ecodrive.ae`;

const resolveImportEmail = (row, usedEmails, excludeEmail = '') => {
  const empNo = row.EMPNO.trim();
  const fallbackEmail = buildFallbackEmail(empNo);
  const email = row['Work Email']?.trim().toLowerCase();
  const excluded = excludeEmail.trim().toLowerCase();

  if (!email) {
    return { email: fallbackEmail, usedFallback: true };
  }

  if (email !== excluded && usedEmails.has(email)) {
    return { email: fallbackEmail, usedFallback: true };
  }

  return { email, usedFallback: false };
};

const mapWorkingHoursToShift = (workingHours) => {
  const value = String(workingHours || '').trim().toLowerCase();

  if (value.includes('driving instructor')) {
    return { shiftStartTime: '08:00', shiftEndTime: '20:00' };
  }

  if (value.includes('temporary schedule')) {
    return { shiftStartTime: '09:00', shiftEndTime: '19:00' };
  }

  if (value.includes('second shift')) {
    return { shiftStartTime: '14:00', shiftEndTime: '22:00' };
  }

  if (value.includes('emirati')) {
    return { shiftStartTime: '07:30', shiftEndTime: '15:30' };
  }

  return {
    shiftStartTime: DEFAULT_SHIFT_START,
    shiftEndTime: DEFAULT_SHIFT_END,
  };
};

const loadBranchLookup = async () => {
  const branches = await Branch.find().select('_id name');
  const lookup = new Map();

  for (const branch of branches) {
    lookup.set(normalizeBranchKey(branch.name), branch);
  }

  return lookup;
};

const loadExistingImportKeys = async () => {
  const users = await User.find({}).select('_id empNo email');
  const empNoToUser = new Map();
  const emails = new Set();

  for (const user of users) {
    if (user.email) {
      emails.add(user.email);
    }
    if (user.empNo) {
      empNoToUser.set(user.empNo, {
        _id: user._id,
        email: user.email,
      });
    }
  }

  return { empNoToUser, emails };
};

const resolveBranchForRow = async ({
  row,
  branchLookup,
  matchedBranchKeys,
  summary,
}) => {
  const branchName = row.Branch.trim();
  const branchKey = normalizeBranchKey(branchName);
  let branch = branchLookup.get(branchKey);

  if (!branch) {
    const shift = mapWorkingHoursToShift(row['Working Hours']);
    branch = await Branch.create({
      name: normalizeBranchName(branchName),
      address: normalizeBranchName(branchName),
      latitude: DEFAULT_IMPORT_LATITUDE,
      longitude: DEFAULT_IMPORT_LONGITUDE,
      radiusMeters: DEFAULT_IMPORT_RADIUS_METERS,
      graceMinutesLate: DEFAULT_GRACE_MINUTES_LATE,
      ...shift,
    });
    branchLookup.set(branchKey, branch);
    summary.branchesCreated += 1;
  } else if (!matchedBranchKeys.has(branchKey)) {
    matchedBranchKeys.add(branchKey);
    summary.branchesMatched += 1;
  }

  return branch;
};

const hashEmployeeBatch = async (employees) => {
  const chunkSize = 25;
  const hashed = [];

  for (let index = 0; index < employees.length; index += chunkSize) {
    const chunk = employees.slice(index, index + chunkSize);
    const chunkHashed = await Promise.all(
      chunk.map(async (employee) => ({
        ...employee,
        _id: await generateCustomId(ID_PREFIX.EMPLOYEE),
        password: await bcrypt.hash(employee.password, 12),
      }))
    );
    hashed.push(...chunkHashed);
  }

  return hashed;
};

const createEmployeesInBatches = async (employees, summary) => {
  const batchSize = 100;

  for (let index = 0; index < employees.length; index += batchSize) {
    const plainBatch = employees.slice(index, index + batchSize);
    const hashedBatch = await hashEmployeeBatch(plainBatch);

    try {
      await User.insertMany(hashedBatch, { ordered: false });
      summary.employeesCreated += plainBatch.length;
    } catch (error) {
      for (const employee of plainBatch) {
        try {
          await User.create(employee);
          summary.employeesCreated += 1;
        } catch (rowError) {
          summary.employeesFailed += 1;
          summary.errors.push({
            empNo: employee.empNo,
            name: employee.name,
            reason: rowError.message || 'Failed to import row',
          });
        }
      }
    }
  }
};

const bulkImportEmployeesFromExcel = async (buffer) => {
  const rows = parseEmployeeWorkbook(buffer);
  const summary = {
    totalRows: rows.length,
    skippedEmptyRows: 0,
    branchesCreated: 0,
    branchesMatched: 0,
    employeesCreated: 0,
    employeesUpdated: 0,
    employeesSkippedDuplicate: 0,
    employeesFailed: 0,
    emailsAutoAssigned: 0,
    errors: [],
  };

  const branchLookup = await loadBranchLookup();
  const existingKeys = await loadExistingImportKeys();
  const employeesToCreate = [];
  const matchedBranchKeys = new Set();

  for (const row of rows) {
    if (isEmptyImportRow(row)) {
      summary.skippedEmptyRows += 1;
      continue;
    }

    const empNo = row.EMPNO.trim();
    const branchName = row.Branch.trim();

    if (!branchName) {
      summary.employeesFailed += 1;
      summary.errors.push({
        empNo,
        name: row['Employee Name'],
        reason: 'Branch is required',
      });
      continue;
    }

    try {
      const branch = await resolveBranchForRow({
        row,
        branchLookup,
        matchedBranchKeys,
        summary,
      });

      const existingUser = existingKeys.empNoToUser.get(empNo);

      if (existingUser) {
        const { email, usedFallback } = resolveImportEmail(
          row,
          existingKeys.emails,
          existingUser.email
        );

        if (usedFallback) {
          summary.emailsAutoAssigned += 1;
        }

        const fields = mapExcelRowToEmployeeFields({
          row,
          email,
          branch,
          includeCredentials: false,
        });

        if (
          email !== existingUser.email &&
          existingKeys.emails.has(email)
        ) {
          fields.email = existingUser.email;
        } else if (email !== existingUser.email) {
          existingKeys.emails.delete(existingUser.email);
          existingKeys.emails.add(email);
        }

        await User.updateOne({ _id: existingUser._id }, { $set: fields });
        summary.employeesUpdated += 1;
        continue;
      }

      const { email, usedFallback } = resolveImportEmail(
        row,
        existingKeys.emails
      );

      if (existingKeys.emails.has(email)) {
        summary.employeesSkippedDuplicate += 1;
        continue;
      }

      if (usedFallback) {
        summary.emailsAutoAssigned += 1;
      }

      employeesToCreate.push(
        mapExcelRowToEmployeeFields({
          row,
          email,
          branch,
          includeCredentials: true,
        })
      );

      existingKeys.empNoToUser.set(empNo, { _id: null, email });
      existingKeys.emails.add(email);
    } catch (error) {
      summary.employeesFailed += 1;
      summary.errors.push({
        empNo,
        name: row['Employee Name'],
        reason: error.message || 'Failed to prepare row',
      });
    }
  }

  await createEmployeesInBatches(employeesToCreate, summary);

  if (
    summary.employeesCreated === 0 &&
    summary.employeesUpdated === 0 &&
    summary.employeesSkippedDuplicate === 0 &&
    summary.skippedEmptyRows === rows.length
  ) {
    throw new ApiError(400, 'No valid employee rows found in the Excel file');
  }

  return summary;
};

module.exports = {
  bulkImportEmployeesFromExcel,
  buildImportPassword,
};
