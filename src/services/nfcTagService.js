const NfcTag = require('../models/NfcTag');
const ApiError = require('../utils/ApiError');
const { normalizeTagUid, isValidTagUid } = require('../utils/nfcUid');
const { sanitizeNfcTag } = require('../utils/userPresenter');
const branchService = require('./branchService');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAllNfcTags = async ({ branchId, search } = {}) => {
  const filter = {};

  if (branchId?.trim()) {
    filter.branchId = branchId.trim();
  }

  if (search?.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [
      { label: regex },
      { tagUid: regex },
      { branchName: regex },
      { _id: regex },
    ];
  }

  const tags = await NfcTag.find(filter).sort({ createdAt: -1 });
  return tags.map(sanitizeNfcTag);
};

const resolveActiveNfcTag = async ({ nfcTagId, tagUid }) => {
  if (!nfcTagId && !tagUid) {
    throw new ApiError(400, 'nfcTagId or tagUid is required');
  }

  const tag = nfcTagId
    ? await NfcTag.findById(nfcTagId)
    : await NfcTag.findOne({ tagUid: normalizeTagUid(tagUid) });

  if (!tag) {
    throw new ApiError(
      404,
      'NFC tag serial number is not registered. Check-in is not allowed.'
    );
  }

  if (!tag.isActive) {
    throw new ApiError(400, 'NFC tag is inactive');
  }

  return tag;
};

const createNfcTag = async ({ branchId, tagUid, label, isActive = true }) => {
  const normalizedUid = normalizeTagUid(tagUid);

  if (!isValidTagUid(normalizedUid)) {
    throw new ApiError(400, 'Enter a valid NFC tag UID');
  }

  const existing = await NfcTag.findOne({ tagUid: normalizedUid });
  if (existing) {
    throw new ApiError(409, 'This NFC tag UID is already registered');
  }

  const branch = await branchService.resolveActiveBranch(branchId);

  const tag = await NfcTag.create({
    branchId: branch._id,
    branchName: branch.name,
    tagUid: normalizedUid,
    label: label?.trim() || '',
    isActive,
  });

  return sanitizeNfcTag(tag);
};

const updateNfcTag = async (nfcTagId, payload) => {
  const tag = await NfcTag.findById(nfcTagId);

  if (!tag) {
    throw new ApiError(404, 'NFC tag not found');
  }

  if (payload.branchId !== undefined) {
    const branch = await branchService.resolveActiveBranch(payload.branchId);
    tag.branchId = branch._id;
    tag.branchName = branch.name;
  }

  if (payload.tagUid !== undefined) {
    const normalizedUid = normalizeTagUid(payload.tagUid);
    if (!isValidTagUid(normalizedUid)) {
      throw new ApiError(400, 'Enter a valid NFC tag UID');
    }

    const duplicate = await NfcTag.findOne({
      tagUid: normalizedUid,
      _id: { $ne: tag._id },
    });
    if (duplicate) {
      throw new ApiError(409, 'This NFC tag UID is already registered');
    }

    tag.tagUid = normalizedUid;
  }

  if (payload.label !== undefined) {
    tag.label = payload.label.trim();
  }

  if (payload.isActive !== undefined) {
    tag.isActive = payload.isActive;
  }

  await tag.save();
  return sanitizeNfcTag(tag);
};

const touchLastScanned = async (nfcTagId) => {
  await NfcTag.findByIdAndUpdate(nfcTagId, {
    $set: { lastScannedAt: new Date() },
  });
};

const syncBranchName = async (branchId, branchName) => {
  await NfcTag.updateMany({ branchId }, { $set: { branchName } });
};

module.exports = {
  getAllNfcTags,
  resolveActiveNfcTag,
  createNfcTag,
  updateNfcTag,
  touchLastScanned,
  syncBranchName,
};
