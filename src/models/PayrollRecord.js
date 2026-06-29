const mongoose = require('mongoose');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');

const payrollRecordSchema = new mongoose.Schema(
  {
    _id: { type: String },
    empNo: {
      type: String,
      required: [true, 'EMP number is required'],
      trim: true,
    },
    empName: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
    jobDesignation: { type: String, trim: true, default: '' },
    doj: { type: Date, default: null },
    basic: { type: Number, default: 0 },
    otherAllowance: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    fuel: { type: Number, default: 0 },
    tra: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },
    periodFrom: {
      type: Date,
      required: [true, 'Period start date is required'],
    },
    periodTo: {
      type: Date,
      required: [true, 'Period end date is required'],
    },
    noDays: { type: Number, default: 0 },
    salaryPayable: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    instructorIncentive: { type: Number, default: 0 },
    arrears: { type: Number, default: 0 },
    otArrears: { type: Number, default: 0 },
    categoryAllowance: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    loanDeduction: { type: Number, default: 0 },
    oneTimeDeduction: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

payrollRecordSchema.index(
  { empNo: 1, periodFrom: 1, periodTo: 1 },
  { unique: true }
);

payrollRecordSchema.pre('validate', async function assignPayrollId(next) {
  if (this.isNew && !this._id) {
    this._id = await generateCustomId(ID_PREFIX.PAYROLL);
  }

  next();
});

module.exports = mongoose.model('PayrollRecord', payrollRecordSchema);
