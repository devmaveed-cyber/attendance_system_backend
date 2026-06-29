const Group = require('../models/Group');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { APP_SECTIONS, normalizeSections } = require('../constants/appSections');
const { sanitizeGroup } = require('../utils/userPresenter');

const FULL_ACCESS_GROUP_ID = 'GRP9999001';
const FULL_ACCESS_GROUP_NAME = 'Full Access';

const ensureBootstrapGroups = async () => {
  const existing = await Group.findById(FULL_ACCESS_GROUP_ID);

  if (!existing) {
    await Group.create({
      _id: FULL_ACCESS_GROUP_ID,
      name: FULL_ACCESS_GROUP_NAME,
      sections: APP_SECTIONS,
      isSystem: true,
    });
    return;
  }

  const normalized = normalizeSections(existing.sections);
  const missing = APP_SECTIONS.filter(
    (section) => !normalized.includes(section)
  );
  const nextSections = [...new Set([...normalized, ...missing])];

  if (
    nextSections.length !== existing.sections.length ||
    existing.sections.some((section) => !nextSections.includes(section))
  ) {
    existing.sections = nextSections;
    await existing.save();
  }
};

const getAllGroups = async () => {
  await ensureBootstrapGroups();
  const groups = await Group.find().sort({ createdAt: -1 });

  for (const group of groups) {
    const normalized = normalizeSections(group.sections);
    const nextSections =
      normalized.length > 0 ? normalized : ['dashboard'];

    if (
      nextSections.length !== group.sections.length ||
      group.sections.some((section) => !nextSections.includes(section))
    ) {
      group.sections = nextSections;
      await group.save();
    }
  }

  return groups.map(sanitizeGroup);
};

const resolveActiveGroup = async (groupId) => {
  const group = await Group.findById(groupId);

  if (!group) {
    throw new ApiError(404, 'Selected group was not found');
  }

  if (!group.isActive) {
    throw new ApiError(400, 'Selected group is inactive');
  }

  return group;
};

const createGroup = async ({ name, sections }) => {
  const normalizedSections = normalizeSections(sections);

  if (normalizedSections.length === 0) {
    throw new ApiError(400, 'Select at least one section for the group');
  }

  const group = await Group.create({
    name,
    sections: normalizedSections,
  });

  return sanitizeGroup(group);
};

const updateGroup = async (groupId, payload) => {
  const group = await Group.findById(groupId);

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (payload.name !== undefined) {
    group.name = payload.name;
  }

  if (payload.sections !== undefined) {
    const normalizedSections = normalizeSections(payload.sections);

    if (normalizedSections.length === 0) {
      throw new ApiError(400, 'Select at least one section for the group');
    }

    group.sections = normalizedSections;
  }

  if (payload.isActive !== undefined) {
    group.isActive = payload.isActive;
  }

  await group.save();
  return sanitizeGroup(group);
};

const deleteGroup = async (groupId) => {
  const group = await Group.findById(groupId);

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (group.isSystem || group._id === FULL_ACCESS_GROUP_ID) {
    throw new ApiError(400, 'System groups cannot be deleted');
  }

  const unassignResult = await User.updateMany(
    { groupId: group._id, accountRole: { $ne: 'employee' } },
    { $set: { groupId: '', groupName: '' } }
  );

  await Group.deleteOne({ _id: group._id });

  return {
    groupId: group._id,
    name: group.name,
    unassignedUserCount: unassignResult.modifiedCount,
  };
};

module.exports = {
  ensureBootstrapGroups,
  getAllGroups,
  resolveActiveGroup,
  createGroup,
  updateGroup,
  deleteGroup,
};
