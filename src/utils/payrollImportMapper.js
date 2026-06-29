const { parseOptionalDate } = require('./employeeImportMapper');

const parsePayrollNumber = (value) => {
  if (value === null || value === undefined) return 0;

  const normalized = String(value)
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || normalized === '-' || normalized === '—') {
    return 0;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePayrollInteger = (value) => {
  const parsed = parsePayrollNumber(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const computeGrossSalary = (fields) =>
  fields.basic +
  fields.otherAllowance +
  fields.hra +
  fields.specialAllowance +
  fields.fuel +
  fields.tra;

const computeNetPayable = (fields) =>
  fields.salaryPayable +
  fields.overtime +
  fields.instructorIncentive +
  fields.arrears +
  fields.otArrears +
  fields.categoryAllowance +
  fields.commission -
  fields.loanDeduction -
  fields.oneTimeDeduction;

const resolveEmpNo = (payload) =>
  String(payload.empNo || payload.empCode || '').trim();

const mapExcelRowToPayrollFields = (row) => {
  const fields = {
    empNo: row['EMP. CODE'].trim(),
    empName: row['EMP. NAME'].trim(),
    jobDesignation: row['Job designation'] || '',
    doj: parseOptionalDate(row.DOJ),
    basic: parsePayrollNumber(row['BASIC ']),
    otherAllowance: parsePayrollNumber(row['OTHER ALLOW.']),
    hra: parsePayrollNumber(row.HRA),
    specialAllowance: parsePayrollNumber(row['Spcl. Allow']),
    fuel: parsePayrollNumber(row.Fuel),
    tra: parsePayrollNumber(row.TRA),
    grossSalary: parsePayrollNumber(row['GROSS SALARY']),
    periodFrom: parseOptionalDate(row.From),
    periodTo: parseOptionalDate(row.To),
    noDays: parsePayrollInteger(row['NO. DAYS']),
    salaryPayable: parsePayrollNumber(row['SALARY PAYABLE']),
    overtime: parsePayrollNumber(row.OVERTIME),
    instructorIncentive: parsePayrollNumber(row['Instructor incentive']),
    arrears: parsePayrollNumber(row.Arrears),
    otArrears: parsePayrollNumber(row['OT Arrears']),
    categoryAllowance: parsePayrollNumber(
      row['Category Allowance/VIP Allowance/Assesment Allowance']
    ),
    commission: parsePayrollNumber(row.Commission),
    loanDeduction: parsePayrollNumber(row['Loan Ded.']),
    oneTimeDeduction: parsePayrollNumber(row['One Time Ded.']),
    netPayable: parsePayrollNumber(row['NET PAYABLE']),
    remarks: row.Remarks || '',
  };

  if (!fields.grossSalary) {
    fields.grossSalary = computeGrossSalary(fields);
  }

  if (!fields.netPayable) {
    fields.netPayable = computeNetPayable(fields);
  }

  return fields;
};

const normalizePayrollPayload = (payload) => {
  const fields = {
    empNo: resolveEmpNo(payload),
    empName: String(payload.empName || '').trim(),
    jobDesignation: String(payload.jobDesignation || '').trim(),
    doj: parseOptionalDate(payload.doj),
    basic: parsePayrollNumber(payload.basic),
    otherAllowance: parsePayrollNumber(payload.otherAllowance),
    hra: parsePayrollNumber(payload.hra),
    specialAllowance: parsePayrollNumber(payload.specialAllowance),
    fuel: parsePayrollNumber(payload.fuel),
    tra: parsePayrollNumber(payload.tra),
    grossSalary: parsePayrollNumber(payload.grossSalary),
    periodFrom: parseOptionalDate(payload.periodFrom),
    periodTo: parseOptionalDate(payload.periodTo),
    noDays: parsePayrollInteger(payload.noDays),
    salaryPayable: parsePayrollNumber(payload.salaryPayable),
    overtime: parsePayrollNumber(payload.overtime),
    instructorIncentive: parsePayrollNumber(payload.instructorIncentive),
    arrears: parsePayrollNumber(payload.arrears),
    otArrears: parsePayrollNumber(payload.otArrears),
    categoryAllowance: parsePayrollNumber(payload.categoryAllowance),
    commission: parsePayrollNumber(payload.commission),
    loanDeduction: parsePayrollNumber(payload.loanDeduction),
    oneTimeDeduction: parsePayrollNumber(payload.oneTimeDeduction),
    netPayable: parsePayrollNumber(payload.netPayable),
    remarks: String(payload.remarks || '').trim(),
  };

  fields.grossSalary = computeGrossSalary(fields);
  fields.netPayable = computeNetPayable(fields);

  return fields;
};

module.exports = {
  parsePayrollNumber,
  parsePayrollInteger,
  computeGrossSalary,
  computeNetPayable,
  resolveEmpNo,
  mapExcelRowToPayrollFields,
  normalizePayrollPayload,
};
