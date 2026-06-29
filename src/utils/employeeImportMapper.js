const { normalizePhone } = require('./phoneUtils');

const parseOptionalDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildImportPassword = (empNo) => `ecodrive@${String(empNo).trim()}`;

const mapExcelRowToEmployeeFields = ({
  row,
  email,
  branch,
  includeCredentials = true,
}) => {
  const empNo = row.EMPNO.trim();
  const fields = {
    empNo,
    name: row['Employee Name'].trim(),
    email,
    phone: normalizePhone(row['Work Phone']),
    department: row.Department || '',
    jobPosition: row['Job Position'] || '',
    workingHours: row['Working Hours'] || '',
    visaExpiryDate: parseOptionalDate(row['Visa Expiry Date']),
    gender: row.Gender || '',
    nationality: row['Nationality (Country)'] || '',
    instructorPermitNo: row['Instructor Permit No'] || '',
    company: row.Company || '',
    gearType: row['Gear Type'] || '',
    instructorLicenseTypes: row['Instructor License Types'] || '',
    hrCreatedOn: parseOptionalDate(row['Created on']),
    hrCreatedBy: row['Created by'] || '',
    manager: row.Manager || '',
    branchId: branch._id,
    branchName: branch.name,
    groupId: '',
    groupName: '',
    accountRole: 'employee',
  };

  if (includeCredentials) {
    fields.password = buildImportPassword(empNo);
  }

  return fields;
};

module.exports = {
  parseOptionalDate,
  mapExcelRowToEmployeeFields,
  normalizePhone,
  buildImportPassword,
};
