const mongoose = require('mongoose');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');
const { normalizeTagUid } = require('../utils/nfcUid');

const nfcTagSchema = new mongoose.Schema(
  {
    _id: { type: String },
    branchId: {
      type: String,
      required: [true, 'Branch is required'],
      index: true,
    },
    branchName: {
      type: String,
      required: true,
      trim: true,
    },
    tagUid: {
      type: String,
      required: [true, 'NFC tag UID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    label: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastScannedAt: Date,
  },
  { timestamps: true }
);

nfcTagSchema.pre('validate', async function assignNfcTagId(next) {
  if (this.isNew && !this._id) {
    this._id = await generateCustomId(ID_PREFIX.NFC);
  }

  if (this.tagUid) {
    this.tagUid = normalizeTagUid(this.tagUid);
  }

  next();
});

module.exports = mongoose.model('NfcTag', nfcTagSchema);
