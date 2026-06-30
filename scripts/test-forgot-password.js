require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
process.env.JWT_SECRET ||= 'test-secret-key-for-forgot-password';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/forgot-password-test';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const PasswordResetOtp = require('../src/models/PasswordResetOtp');
const User = require('../src/models/User');
const smsService = require('../src/services/smsService');
const forgotPasswordService = require('../src/services/forgotPasswordService');
const { signPasswordResetToken } = require('../src/utils/token');

const PHONE = '971565236158';
let sentOtp = null;

const makeEmployee = () => ({
  _id: '11366',
  accountRole: 'employee',
  isActive: true,
  phone: PHONE,
  password: 'hashed-old',
  isModified(field) {
    return field === 'password';
  },
  async save() {
    this.saved = true;
  },
});

const makeUserQuery = (rows) => ({
  select: async () => rows,
  then(onFulfilled, onRejected) {
    return Promise.resolve(rows).then(onFulfilled, onRejected);
  },
});

test.beforeEach(() => {
  sentOtp = null;

  User.find = () => makeUserQuery([makeEmployee()]);

  PasswordResetOtp.findOne = (query) => {
    const record =
      query?.phone === PHONE ? PasswordResetOtp._record : null;

    return {
      select: async () => record,
      then(onFulfilled, onRejected) {
        return Promise.resolve(record).then(onFulfilled, onRejected);
      },
    };
  };

  PasswordResetOtp.findOneAndUpdate = async (_query, update) => {
    PasswordResetOtp._record = {
      phone: update.phone,
      otpHash: update.otpHash,
      attempts: update.attempts ?? 0,
      verified: update.verified ?? false,
      lastSentAt: update.lastSentAt,
      expiresAt: update.expiresAt,
      async save() {
        PasswordResetOtp._record = this;
      },
    };
    return PasswordResetOtp._record;
  };

  PasswordResetOtp.deleteOne = async () => {
    PasswordResetOtp._record = null;
    return { deletedCount: 1 };
  };

  PasswordResetOtp._record = null;

  smsService.sendOtpSms = async (_phone, otp) => {
    sentOtp = otp;
  };
});

test('sendOtp stores hashed OTP and sends SMS', async () => {
  const result = await forgotPasswordService.sendOtp(PHONE);

  assert.equal(result.phone, PHONE);
  assert.match(sentOtp, /^\d{6}$/);
  assert.ok(PasswordResetOtp._record);
  assert.equal(
    await bcrypt.compare(sentOtp, PasswordResetOtp._record.otpHash),
    true
  );
});

test('verifyOtp returns reset token for valid code', async () => {
  await forgotPasswordService.sendOtp(PHONE);
  const { resetToken } = await forgotPasswordService.verifyOtp(PHONE, sentOtp);

  assert.ok(resetToken);
  assert.equal(PasswordResetOtp._record.verified, true);
});

test('resetPassword updates employee password after verified OTP', async () => {
  await forgotPasswordService.sendOtp(PHONE);
  const { resetToken } = await forgotPasswordService.verifyOtp(PHONE, sentOtp);

  const employee = makeEmployee();
  User.find = () => makeUserQuery([employee]);

  await forgotPasswordService.resetPassword(
    PHONE,
    resetToken,
    'plain-new-password'
  );

  assert.equal(employee.password, 'plain-new-password');
  assert.equal(employee.saved, true);
  assert.equal(PasswordResetOtp._record, null);
});

test('verifyOtp rejects invalid code', async () => {
  await forgotPasswordService.sendOtp(PHONE);

  await assert.rejects(
    () => forgotPasswordService.verifyOtp(PHONE, '000000'),
    (error) => error.statusCode === 400
  );
});

test('resetPassword rejects missing verification', async () => {
  PasswordResetOtp._record = {
    phone: PHONE,
    verified: false,
    expiresAt: new Date(Date.now() + 60000),
  };

  const resetToken = signPasswordResetToken(PHONE);

  await assert.rejects(
    () =>
      forgotPasswordService.resetPassword(
        PHONE,
        resetToken,
        'new-password'
      ),
    (error) => error.statusCode === 400
  );
});
