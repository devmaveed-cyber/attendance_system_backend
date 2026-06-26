const NfcTag = require('../models/NfcTag');
const ApiError = require('../utils/ApiError');
const { normalizeTagUid, isValidTagUid } = require('../utils/nfcUid');
const { sanitizeNfcTag } = require('../utils/userPresenter');
const { buildPaginationMeta } = require('../utils/paginationUtils');
const branchService = require('./branchService');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildNfcTagSearchFilter = ({ branchId, search } = {}) => {
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

  return filter;
};

const getNfcTags = async ({ page = 1, limit = 25, branchId, search } = {}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;
  const filter = buildNfcTagSearchFilter({ branchId, search });

  const [tags, total] = await Promise.all([
    NfcTag.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
    NfcTag.countDocuments(filter),
  ]);

  return {
    tags: tags.map(sanitizeNfcTag),
    pagination: buildPaginationMeta({
      page: safePage,
      limit: safeLimit,
      total,
    }),
  };
};

const getAllNfcTags = async ({ branchId, search } = {}) => {
  const { tags } = await getNfcTags({ page: 1, limit: 100, branchId, search });
  return tags;
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

const resolveOptionalBranch = async (branchId) => {
  if (!branchId?.trim()) {
    return { branchId: '', branchName: '' };
  }

  const branch = await branchService.resolveActiveBranch(branchId.trim());
  return { branchId: branch._id, branchName: branch.name };
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

  const branch = await resolveOptionalBranch(branchId);

  const tag = await NfcTag.create({
    branchId: branch.branchId,
    branchName: branch.branchName,
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
    const branch = await resolveOptionalBranch(payload.branchId);
    tag.branchId = branch.branchId;
    tag.branchName = branch.branchName;
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

const deleteNfcTag = async (nfcTagId) => {
  const tag = await NfcTag.findById(nfcTagId);

  if (!tag) {
    throw new ApiError(404, 'NFC tag not found');
  }

  await NfcTag.deleteOne({ _id: tag._id });

  return {
    nfcTagId: tag._id,
    label: tag.label,
    tagUid: tag.tagUid,
  };
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
  getNfcTags,
  getAllNfcTags,
  resolveActiveNfcTag,
  createNfcTag,
  updateNfcTag,
  deleteNfcTag,
  touchLastScanned,
  syncBranchName,
};
