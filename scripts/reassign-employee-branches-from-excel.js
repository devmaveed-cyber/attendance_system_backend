#!/usr/bin/env node
/**
 * Re-assign employee branches from the HR Excel export (same format as bulk import).
 *
 * Usage:
 *   node scripts/reassign-employee-branches-from-excel.js /path/to/employees.xlsx
 *   node scripts/reassign-employee-branches-from-excel.js /path/to/employees.xlsx --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bulkImportService = require('../src/services/bulkImportService');

const filePath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (!filePath) {
    throw new Error(
      'Excel file path is required.\nExample: node scripts/reassign-employee-branches-from-excel.js ~/Downloads/employees.xlsx'
    );
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${dryRun ? ' [DRY RUN]' : ''}`);
  console.log(`Reading: ${resolvedPath}`);

  const buffer = fs.readFileSync(resolvedPath);

  if (dryRun) {
    const { parseEmployeeWorkbook, isEmptyImportRow } = require('../src/utils/excelParser');
    const rows = parseEmployeeWorkbook(buffer).filter((row) => !isEmptyImportRow(row));
    const withBranch = rows.filter((row) => row.Branch.trim()).length;
    console.log(`Rows with employee data: ${rows.length}`);
    console.log(`Rows with Branch filled: ${withBranch}`);
    console.log('\nDry run only — re-run without --dry-run to apply updates.');
    await mongoose.disconnect();
    return;
  }

  const summary = await bulkImportService.bulkImportEmployeesFromExcel(buffer);

  console.log('\nImport summary:');
  console.log(JSON.stringify(summary, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Reassign failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
