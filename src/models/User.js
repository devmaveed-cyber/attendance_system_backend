const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');
const { normalizePhone } = require('../utils/phoneUtils');

const ACCOUNT_ROLES = ['admin', 'employee'];

const userSchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    groupId: {
      type: String,
      trim: true,
      default: '',
    },
    groupName: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    accountRole: {
      type: String,
      enum: ACCOUNT_ROLES,
      default: 'admin',
    },
    branchId: {
      type: String,
      trim: true,
      default: '',
    },
    branchName: {
      type: String,
      trim: true,
      default: '',
    },
    empNo: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    jobPosition: {
      type: String,
      trim: true,
      default: '',
    },
    workingHours: {
      type: String,
      trim: true,
      default: '',
    },
    visaExpiryDate: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      trim: true,
      default: '',
    },
    nationality: {
      type: String,
      trim: true,
      default: '',
    },
    instructorPermitNo: {
      type: String,
      trim: true,
      default: '',
    },
    company: {
      type: String,
      trim: true,
      default: '',
    },
    gearType: {
      type: String,
      trim: true,
      default: '',
    },
    instructorLicenseTypes: {
      type: String,
      trim: true,
      default: '',
    },
    hrCreatedOn: {
      type: Date,
      default: null,
    },
    hrCreatedBy: {
      type: String,
      trim: true,
      default: '',
    },
    manager: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

userSchema.pre('validate', async function assignUserId(next) {
  if (this.isNew && !this._id) {
    if (this.accountRole === 'employee') {
      const empNo = String(this.empNo || '').trim();

      if (!empNo) {
        return next(new Error('EMP number is required for employees'));
      }

      this._id = empNo;
      this.empNo = empNo;
      return next();
    }

    this._id = await generateCustomId(ID_PREFIX.USER);
  }

  next();
});

userSchema.pre('save', function normalizePhoneField(next) {
  if (this.isModified('phone') || this.isNew) {
    this.phone = normalizePhone(this.phone);
  }

  next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
module.exports.ACCOUNT_ROLES = ACCOUNT_ROLES;
