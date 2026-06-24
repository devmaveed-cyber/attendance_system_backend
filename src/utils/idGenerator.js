const Counter = require('../models/Counter');

const ID_PREFIX = {
  USER: 'USR',
  GROUP: 'GRP',
  EMPLOYEE: 'EMP',
  ATTENDANCE: 'ATT',
  BRANCH: 'BRN',
  NFC: 'NFC',
};

const DIGIT_LENGTH = 7;

const ID_PATTERN = {
  USER: /^USR\d{7}$/,
  GROUP: /^GRP\d{7}$/,
  EMPLOYEE: /^EMP\d{7}$/,
  ATTENDANCE: /^ATT\d{7}$/,
  BRANCH: /^BRN\d{7}$/,
  NFC: /^NFC\d{7}$/,
};

const generateCustomId = async (prefix) => {
  const counter = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(DIGIT_LENGTH, '0');
  return `${prefix}${padded}`;
};

module.exports = {
  ID_PREFIX,
  ID_PATTERN,
  DIGIT_LENGTH,
  generateCustomId,
};
