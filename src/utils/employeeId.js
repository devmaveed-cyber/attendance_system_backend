const { ID_PATTERN } = require('./idGenerator');

const EMP_NO_PATTERN = /^\d{4,10}$/;

const LEGACY_EMPLOYEE_ID_PATTERN = ID_PATTERN.EMPLOYEE;

const EMPLOYEE_ROUTE_ID_PATTERN = new RegExp(
  `^(${EMP_NO_PATTERN.source.slice(1, -1)}|${LEGACY_EMPLOYEE_ID_PATTERN.source.slice(1, -1)}|${ID_PATTERN.USER.source.slice(1, -1)})$`
);

const ATTENDANCE_EMPLOYEE_ID_PATTERN = EMPLOYEE_ROUTE_ID_PATTERN;

const normalizeEmpNo = (value) => String(value || '').trim();

const isEmpNo = (value) => EMP_NO_PATTERN.test(normalizeEmpNo(value));

const isLegacyEmployeeId = (value) =>
  LEGACY_EMPLOYEE_ID_PATTERN.test(String(value || '').trim());

module.exports = {
  EMP_NO_PATTERN,
  LEGACY_EMPLOYEE_ID_PATTERN,
  EMPLOYEE_ROUTE_ID_PATTERN,
  ATTENDANCE_EMPLOYEE_ID_PATTERN,
  normalizeEmpNo,
  isEmpNo,
  isLegacyEmployeeId,
};
