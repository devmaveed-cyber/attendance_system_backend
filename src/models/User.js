const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');

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
  },
  { timestamps: true }
);

userSchema.pre('validate', async function assignUserId(next) {
  if (this.isNew && !this._id) {
    const prefix =
      this.accountRole === 'employee' ? ID_PREFIX.EMPLOYEE : ID_PREFIX.USER;
    this._id = await generateCustomId(prefix);
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
