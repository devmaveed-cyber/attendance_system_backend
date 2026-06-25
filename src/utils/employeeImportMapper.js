const parseOptionalDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('971')) return digits;
  if (digits.startsWith('0')) return `971${digits.slice(1)}`;
  if (digits.length === 9) return `971${digits}`;
  return digits;
};

const buildImportPassword = (empNo) => `ecodrive@${String(empNo).trim()}`;

module.exports = {
  parseOptionalDate,
  mapExcelRowToEmployeeFields,
  normalizePhone,
  buildImportPassword,
};
