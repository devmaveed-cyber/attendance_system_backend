const PayrollRecord = require('../models/PayrollRecord');
const ApiError = require('../utils/ApiError');
const { buildPaginationMeta } = require('../utils/paginationUtils');
const {
  parsePayrollWorkbook,
  isEmptyPayrollImportRow,
} = require('../utils/payrollExcelParser');
const {
  mapExcelRowToPayrollFields,
  normalizePayrollPayload,
} = require('../utils/payrollImportMapper');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let migrationPromise = null;

const ensurePayrollFieldMigration = async () => {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      await PayrollRecord.updateMany(
        {
          empCode: { $exists: true, $nin: [null, ''] },
          $or: [{ empNo: { $exists: false } }, { empNo: '' }],
        },
        [{ $set: { empNo: '$empCode' } }]
      );

      await PayrollRecord.updateMany({}, { $unset: { slNo: '', empCode: '' } });
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }

  return migrationPromise;
};

const readEmpNo = (record) => record.empNo || record.empCode || '';

const sanitizePayroll = (record) => ({
  payrollId: record._id,
  empNo: readEmpNo(record),
  empName: record.empName,
  jobDesignation: record.jobDesignation || '',
  doj: record.doj || null,
  basic: record.basic,
  otherAllowance: record.otherAllowance,
  hra: record.hra,
  specialAllowance: record.specialAllowance,
  fuel: record.fuel,
  tra: record.tra,
  grossSalary: record.grossSalary,
  periodFrom: record.periodFrom,
  periodTo: record.periodTo,
  noDays: record.noDays,
  salaryPayable: record.salaryPayable,
  overtime: record.overtime,
  instructorIncentive: record.instructorIncentive,
  arrears: record.arrears,
  otArrears: record.otArrears,
  categoryAllowance: record.categoryAllowance,
  commission: record.commission,
  loanDeduction: record.loanDeduction,
  oneTimeDeduction: record.oneTimeDeduction,
  netPayable: record.netPayable,
  remarks: record.remarks || '',
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const buildPayrollSearchFilter = (search = '') => {
  const normalized = search.trim();

  if (!normalized) {
    return {};
  }

  const regex = new RegExp(escapeRegex(normalized), 'i');
  return {
    $or: [
      { _id: regex },
      { empNo: regex },
      { empCode: regex },
      { empName: regex },
      { jobDesignation: regex },
      { remarks: regex },
    ],
  };
};

const validatePayrollFields = (fields) => {
  if (!fields.empNo) {
    throw new ApiError(400, 'EMP number is required');
  }

  if (!fields.empName) {
    throw new ApiError(400, 'Employee name is required');
  }

  if (!fields.periodFrom) {
    throw new ApiError(400, 'Period start date is required');
  }

  if (!fields.periodTo) {
    throw new ApiError(400, 'Period end date is required');
  }
};

const getPayrollRecords = async ({ page = 1, limit = 25, search = '' } = {}) => {
  await ensurePayrollFieldMigration();

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;
  const filter = buildPayrollSearchFilter(search);

  const [records, total] = await Promise.all([
    PayrollRecord.find(filter)
      .sort({ periodFrom: -1, empNo: 1 })
      .skip(skip)
      .limit(safeLimit),
    PayrollRecord.countDocuments(filter),
  ]);

  return {
    records: records.map(sanitizePayroll),
    pagination: buildPaginationMeta({
      page: safePage,
      limit: safeLimit,
      total,
    }),
  };
};

const getPayrollRecordsForEmployee = async ({
  empNo,
  page = 1,
  limit = 25,
} = {}) => {
  await ensurePayrollFieldMigration();

  const normalizedEmpNo = String(empNo || '').trim();

  if (!normalizedEmpNo) {
    throw new ApiError(400, 'EMP number is required');
  }

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;
  const filter = {
    $or: [{ empNo: normalizedEmpNo }, { empCode: normalizedEmpNo }],
  };

  const [records, total] = await Promise.all([
    PayrollRecord.find(filter)
      .sort({ periodFrom: -1 })
      .skip(skip)
      .limit(safeLimit),
    PayrollRecord.countDocuments(filter),
  ]);

  return {
    records: records.map(sanitizePayroll),
    pagination: buildPaginationMeta({
      page: safePage,
      limit: safeLimit,
      total,
    }),
  };
};

const createPayrollRecord = async (payload) => {
  await ensurePayrollFieldMigration();

  const fields = normalizePayrollPayload(payload);
  validatePayrollFields(fields);

  const duplicate = await PayrollRecord.findOne({
    empNo: fields.empNo,
    periodFrom: fields.periodFrom,
    periodTo: fields.periodTo,
  });

  if (duplicate) {
    throw new ApiError(
      409,
      'A payroll record already exists for this employee and period'
    );
  }

  const record = await PayrollRecord.create(fields);
  return sanitizePayroll(record);
};

const updatePayrollRecord = async (payrollId, payload) => {
  await ensurePayrollFieldMigration();

  const record = await PayrollRecord.findById(payrollId);

  if (!record) {
    throw new ApiError(404, 'Payroll record not found');
  }

  const fields = normalizePayrollPayload({
    empNo: payload.empNo ?? payload.empCode ?? readEmpNo(record),
    empName: payload.empName ?? record.empName,
    jobDesignation: payload.jobDesignation ?? record.jobDesignation,
    doj: payload.doj ?? record.doj,
    basic: payload.basic ?? record.basic,
    otherAllowance: payload.otherAllowance ?? record.otherAllowance,
    hra: payload.hra ?? record.hra,
    specialAllowance: payload.specialAllowance ?? record.specialAllowance,
    fuel: payload.fuel ?? record.fuel,
    tra: payload.tra ?? record.tra,
    grossSalary: payload.grossSalary ?? record.grossSalary,
    periodFrom: payload.periodFrom ?? record.periodFrom,
    periodTo: payload.periodTo ?? record.periodTo,
    noDays: payload.noDays ?? record.noDays,
    salaryPayable: payload.salaryPayable ?? record.salaryPayable,
    overtime: payload.overtime ?? record.overtime,
    instructorIncentive:
      payload.instructorIncentive ?? record.instructorIncentive,
    arrears: payload.arrears ?? record.arrears,
    otArrears: payload.otArrears ?? record.otArrears,
    categoryAllowance: payload.categoryAllowance ?? record.categoryAllowance,
    commission: payload.commission ?? record.commission,
    loanDeduction: payload.loanDeduction ?? record.loanDeduction,
    oneTimeDeduction: payload.oneTimeDeduction ?? record.oneTimeDeduction,
    netPayable: payload.netPayable ?? record.netPayable,
    remarks: payload.remarks ?? record.remarks,
  });

  validatePayrollFields(fields);

  const duplicate = await PayrollRecord.findOne({
    _id: { $ne: payrollId },
    empNo: fields.empNo,
    periodFrom: fields.periodFrom,
    periodTo: fields.periodTo,
  });

  if (duplicate) {
    throw new ApiError(
      409,
      'Another payroll record already exists for this employee and period'
    );
  }

  Object.assign(record, fields);
  await record.save();
  return sanitizePayroll(record);
};

const deletePayrollRecord = async (payrollId) => {
  const record = await PayrollRecord.findById(payrollId);

  if (!record) {
    throw new ApiError(404, 'Payroll record not found');
  }

  await PayrollRecord.deleteOne({ _id: payrollId });

  return {
    payrollId: record._id,
    empNo: readEmpNo(record),
    empName: record.empName,
  };
};

const bulkImportPayrollFromExcel = async (buffer) => {
  await ensurePayrollFieldMigration();

  const rows = parsePayrollWorkbook(buffer);
  const summary = {
    totalRows: rows.length,
    skippedEmptyRows: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
    errors: [],
  };

  for (const row of rows) {
    if (isEmptyPayrollImportRow(row)) {
      summary.skippedEmptyRows += 1;
      continue;
    }

    const empNo = row['EMP. CODE'].trim();
    const empName = row['EMP. NAME'].trim();

    try {
      const fields = mapExcelRowToPayrollFields(row);
      validatePayrollFields(fields);

      const existing = await PayrollRecord.findOne({
        empNo: fields.empNo,
        periodFrom: fields.periodFrom,
        periodTo: fields.periodTo,
      });

      if (existing) {
        Object.assign(existing, fields);
        await existing.save();
        summary.recordsUpdated += 1;
      } else {
        await PayrollRecord.create(fields);
        summary.recordsCreated += 1;
      }
    } catch (error) {
      summary.recordsFailed += 1;
      summary.errors.push({
        empNo,
        empName,
        reason: error.message || 'Failed to import row',
      });
    }
  }

  if (
    summary.recordsCreated === 0 &&
    summary.recordsUpdated === 0 &&
    summary.skippedEmptyRows === rows.length
  ) {
    throw new ApiError(400, 'No valid payroll rows found in the Excel file');
  }

  return summary;
};

module.exports = {
  getPayrollRecords,
  getPayrollRecordsForEmployee,
  createPayrollRecord,
  updatePayrollRecord,
  deletePayrollRecord,
  bulkImportPayrollFromExcel,
};
