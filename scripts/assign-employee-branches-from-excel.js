#!/usr/bin/env node
/**
 * Assign employee branches from HR Excel, matching Excel branch names to DB branches.
 *
 * Usage:
 *   node scripts/assign-employee-branches-from-excel.js "/path/to/employees.xlsx"
 *   node scripts/assign-employee-branches-from-excel.js "/path/to/employees.xlsx" --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Branch = require('../src/models/Branch');
const User = require('../src/models/User');
const {
  parseEmployeeWorkbook,
  isEmptyImportRow,
} = require('../src/utils/excelParser');
const { resolveBranchFromExcelName } = require('../src/utils/branchNameMatcher');

const filePath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (!filePath) {
    throw new Error(
      'Excel file path is required.\nExample: node scripts/assign-employee-branches-from-excel.js "~/Desktop/employees.xlsx"'
    );
  }

  const resolvedPath = path.resolve(filePath.replace(/^~/, process.env.HOME || ''));
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

  const rows = parseEmployeeWorkbook(fs.readFileSync(resolvedPath)).filter(
    (row) => !isEmptyImportRow(row)
  );
  const branches = await Branch.find().select('_id name isActive');
  const employees = await User.find({ accountRole: 'employee' }).select(
    '_id empNo name branchId branchName'
  );
  const employeeByEmpNo = new Map(
    employees
      .filter((employee) => employee.empNo?.trim())
      .map((employee) => [employee.empNo.trim(), employee])
  );

  const summary = {
    totalRows: rows.length,
    assigned: 0,
    alreadyCorrect: 0,
    skippedEmptyBranch: 0,
    skippedMissingEmployee: 0,
    unmatchedRows: 0,
    branchMappings: {},
    errors: [],
  };

  for (const row of rows) {
    const empNo = row.EMPNO.trim();
    const excelBranchName = row.Branch.trim();
    const employee = employeeByEmpNo.get(empNo);

    if (!employee) {
      summary.skippedMissingEmployee += 1;
      summary.errors.push({
        empNo,
        name: row['Employee Name'],
        reason: 'Employee not found in database',
      });
      continue;
    }

    if (!excelBranchName) {
      summary.skippedEmptyBranch += 1;
      continue;
    }

    const resolved = resolveBranchFromExcelName(excelBranchName, branches);

    if (!resolved.branch) {
      summary.unmatchedRows += 1;
      summary.errors.push({
        empNo,
        name: row['Employee Name'],
        branch: excelBranchName,
        reason: 'No matching branch in database',
      });
      continue;
    }

    const mappingKey = `${excelBranchName} -> ${resolved.branch.name}`;
    summary.branchMappings[mappingKey] = (summary.branchMappings[mappingKey] || 0) + 1;

    if (
      employee.branchId === resolved.branch._id &&
      employee.branchName === resolved.branch.name
    ) {
      summary.alreadyCorrect += 1;
      continue;
    }

    if (!dryRun) {
      await User.updateOne(
        { _id: employee._id },
        {
          $set: {
            branchId: resolved.branch._id,
            branchName: resolved.branch.name,
          },
        }
      );
    }

    summary.assigned += 1;
  }

  const withBranch = dryRun
    ? summary.alreadyCorrect + summary.assigned
    : await User.countDocuments({
        accountRole: 'employee',
        branchId: { $ne: '' },
      });

  console.log('\nBranch mappings used:');
  for (const [mapping, count] of Object.entries(summary.branchMappings).sort()) {
    console.log(`  ${count}x  ${mapping}`);
  }

  console.log('\nSummary:');
  console.log(JSON.stringify({ ...summary, branchMappings: undefined, withBranchAfter: withBranch }, null, 2));

  if (summary.errors.length) {
    console.log('\nIssues:');
    for (const error of summary.errors.slice(0, 20)) {
      console.log(`  - ${error.empNo || '?'} ${error.name}: ${error.reason}${error.branch ? ` (${error.branch})` : ''}`);
    }
    if (summary.errors.length > 20) {
      console.log(`  ... and ${summary.errors.length - 20} more`);
    }
  }

  if (dryRun) {
    console.log('\nDry run only — nothing updated. Re-run without --dry-run to apply.');
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Assign failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
