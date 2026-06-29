const XLSX = require('xlsx');

const EXPECTED_HEADERS = [
  'SL No.',
  'EMP. CODE',
  'EMP. NAME',
  'Job designation',
  'DOJ',
  'BASIC ',
  'OTHER ALLOW.',
  'HRA',
  'Spcl. Allow',
  'Fuel',
  'TRA',
  'GROSS SALARY',
  'From',
  'To',
  'NO. DAYS',
  'SALARY PAYABLE',
  'OVERTIME',
  'Instructor incentive',
  'Arrears',
  'OT Arrears',
  'Category Allowance/VIP Allowance/Assesment Allowance',
  'Commission',
  'Loan Ded.',
  'One Time Ded.',
  'NET PAYABLE',
  'Remarks',
];

const normalizeCell = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

const resolveHeaderKey = (headers, expectedHeader) => {
  if (headers.includes(expectedHeader)) {
    return expectedHeader;
  }

  const trimmedMatch = headers.find(
    (header) => header.trim() === expectedHeader.trim()
  );

  return trimmedMatch || expectedHeader;
};

const parsePayrollWorkbook = (buffer) => {
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
    (header) => !resolveHeaderKey(headers, header)
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
      const key = resolveHeaderKey(headers, header);
      parsed[header] = normalizeCell(row[key]);
    }

    return parsed;
  });
};

const isEmptyPayrollImportRow = (row) =>
  !row['EMP. CODE'] || !row['EMP. NAME'] || !row.From || !row.To;

module.exports = {
  EXPECTED_HEADERS,
  parsePayrollWorkbook,
  isEmptyPayrollImportRow,
};
