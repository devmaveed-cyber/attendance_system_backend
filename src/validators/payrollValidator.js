const { body, param } = require('express-validator');
const { ID_PATTERN } = require('../utils/idGenerator');

const payrollIdRule = param('id')
  .matches(ID_PATTERN.PAYROLL)
  .withMessage('Invalid payroll id format. Expected format: PAY1234567');

const optionalDateRule = (field) =>
  body(field)
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`${field} must be a valid date`);
      }
      return true;
    });

const optionalNumberRule = (field) =>
  body(field).optional({ nullable: true }).isNumeric().withMessage(`${field} must be a number`);

const payrollFieldRules = [
  body('empNo').trim().notEmpty().withMessage('EMP number is required'),
  body('empName').trim().notEmpty().withMessage('Employee name is required'),
  body('jobDesignation').optional().trim(),
  optionalDateRule('doj'),
  optionalNumberRule('basic'),
  optionalNumberRule('otherAllowance'),
  optionalNumberRule('hra'),
  optionalNumberRule('specialAllowance'),
  optionalNumberRule('fuel'),
  optionalNumberRule('tra'),
  optionalNumberRule('grossSalary'),
  body('periodFrom')
    .notEmpty()
    .withMessage('Period start date is required')
    .custom((value) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('periodFrom must be a valid date');
      }
      return true;
    }),
  body('periodTo')
    .notEmpty()
    .withMessage('Period end date is required')
    .custom((value) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('periodTo must be a valid date');
      }
      return true;
    }),
  optionalNumberRule('noDays'),
  optionalNumberRule('salaryPayable'),
  optionalNumberRule('overtime'),
  optionalNumberRule('instructorIncentive'),
  optionalNumberRule('arrears'),
  optionalNumberRule('otArrears'),
  optionalNumberRule('categoryAllowance'),
  optionalNumberRule('commission'),
  optionalNumberRule('loanDeduction'),
  optionalNumberRule('oneTimeDeduction'),
  optionalNumberRule('netPayable'),
  body('remarks').optional().trim(),
];

const createPayrollRules = payrollFieldRules;

const updatePayrollRules = [
  payrollIdRule,
  body('empNo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('EMP number cannot be empty'),
  body('empName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Employee name cannot be empty'),
  body('jobDesignation').optional().trim(),
  optionalDateRule('doj'),
  optionalNumberRule('basic'),
  optionalNumberRule('otherAllowance'),
  optionalNumberRule('hra'),
  optionalNumberRule('specialAllowance'),
  optionalNumberRule('fuel'),
  optionalNumberRule('tra'),
  optionalNumberRule('grossSalary'),
  optionalDateRule('periodFrom'),
  optionalDateRule('periodTo'),
  optionalNumberRule('noDays'),
  optionalNumberRule('salaryPayable'),
  optionalNumberRule('overtime'),
  optionalNumberRule('instructorIncentive'),
  optionalNumberRule('arrears'),
  optionalNumberRule('otArrears'),
  optionalNumberRule('categoryAllowance'),
  optionalNumberRule('commission'),
  optionalNumberRule('loanDeduction'),
  optionalNumberRule('oneTimeDeduction'),
  optionalNumberRule('netPayable'),
  body('remarks').optional().trim(),
];

const deletePayrollRules = [payrollIdRule];

module.exports = {
  createPayrollRules,
  updatePayrollRules,
  deletePayrollRules,
};
