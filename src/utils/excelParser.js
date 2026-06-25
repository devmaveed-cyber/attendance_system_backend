const XLSX = require('xlsx');

const EXPECTED_HEADERS = [
  'EMPNO',
  'Employee Name',
  'Working Hours',
  'Visa Expiry Date',
  'Branch',
  'Work Phone',
  'Gender',
  'Work Email',
  'Nationality (Country)',
  'Instructor Permit No',
  'Company',
  'Department',
  'Job Position',
  'Gear Type',
  'Instructor License Types',
  'Created on',
  'Created by',
  'Manager',
];

const normalizeCell = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

const parseEmployeeWorkbook = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('Excel file has no worksheets');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: null,
    raw: false,
  });

  if (!rows.length) {
    throw new Error('Excel worksheet is empty');
  }

  const headers = Object.keys(rows[0]);
  const missingHeaders = EXPECTED_HEADERS.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length) {
    throw new Error(
      `Missing required columns: ${missingHeaders.slice(0, 5).join(', ')}${
        missingHeaders.length > 5 ? '…' : ''
      }`
    );
  }

  return rows.map((row) => {
    const parsed = {};
    for (const header of EXPECTED_HEADERS) {
      parsed[header] = normalizeCell(row[header]);
    }
    return parsed;
  });
};

const isEmptyImportRow = (row) =>
  !row.EMPNO || !row['Employee Name'];

module.exports = {
  EXPECTED_HEADERS,
  parseEmployeeWorkbook,
  isEmptyImportRow,
};
