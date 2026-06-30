const Announcement = require('../models/Announcement');
const AnnouncementRead = require('../models/AnnouncementRead');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { resolveAllowedSections } = require('./authService');
const { buildPaginationMeta } = require('../utils/paginationUtils');
const pushNotificationService = require('./pushNotificationService');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeAnnouncement = (announcement, { isRead = false } = {}) => ({
  announcementId: announcement._id,
  title: announcement.title,
  body: announcement.body,
  createdBy: announcement.createdBy,
  createdByName: announcement.createdByName || '',
  publishedAt: announcement.publishedAt,
  targetType: announcement.targetType || 'all',
  isActive: announcement.isActive !== false,
  isRead,
  createdAt: announcement.createdAt,
  updatedAt: announcement.updatedAt,
});

const assertAdminAnnouncementAccess = async (user) => {
  if (user.accountRole === 'employee') {
    throw new ApiError(403, 'Employees view announcements in the mobile app');
  }

  const allowed = await resolveAllowedSections(user);
  if (!allowed.includes('announcements')) {
    throw new ApiError(403, 'You do not have permission to manage announcements');
  }
};

const buildSearchFilter = (search = '') => {
  const normalized = search.trim();
  if (!normalized) return {};

  const regex = new RegExp(escapeRegex(normalized), 'i');
  return {
    $or: [{ title: regex }, { body: regex }, { createdByName: regex }],
  };
};

const listAnnouncementsForAdmin = async (
  user,
  { page = 1, limit = 25, search = '' } = {}
) => {
  await assertAdminAnnouncementAccess(user);

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const filter = {
    isActive: true,
    ...buildSearchFilter(search),
  };

  const [items, total] = await Promise.all([
    Announcement.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    Announcement.countDocuments(filter),
  ]);

  return {
    announcements: items.map((item) => sanitizeAnnouncement(item)),
    pagination: buildPaginationMeta({
      page: safePage,
      limit: safeLimit,
      total,
    }),
  };
};

const createAnnouncement = async (user, { title, body }) => {
  await assertAdminAnnouncementAccess(user);

  const trimmedTitle = String(title || '').trim();
  const trimmedBody = String(body || '').trim();

  if (!trimmedTitle) {
    throw new ApiError(400, 'Title is required');
  }
  if (!trimmedBody) {
    throw new ApiError(400, 'Message body is required');
  }

  const announcement = await Announcement.create({
    title: trimmedTitle,
    body: trimmedBody,
    createdBy: user._id,
    createdByName: user.name?.trim() || user._id,
    publishedAt: new Date(),
    targetType: 'all',
    isActive: true,
  });

  const pushSummary = await pushNotificationService.notifyAllEmployeesAnnouncement({
    title: trimmedTitle,
    body: trimmedBody,
    announcementId: announcement._id,
  });

  return {
    announcement: sanitizeAnnouncement(announcement),
    pushSummary,
  };
};

const deleteAnnouncement = async (user, announcementId) => {
  await assertAdminAnnouncementAccess(user);

  const announcement = await Announcement.findById(announcementId);
  if (!announcement || !announcement.isActive) {
    throw new ApiError(404, 'Announcement not found');
  }

  announcement.isActive = false;
  await announcement.save();

  return sanitizeAnnouncement(announcement);
};

const listMyAnnouncements = async (
  user,
  { page = 1, limit = 25 } = {}
) => {
  if (user.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employees can use this endpoint');
  }

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const filter = { isActive: true };

  const [items, total, readRows] = await Promise.all([
    Announcement.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    Announcement.countDocuments(filter),
    AnnouncementRead.find({ userId: user._id }).select('announcementId'),
  ]);

  const readIds = new Set(readRows.map((row) => row.announcementId));

  return {
    announcements: items.map((item) =>
      sanitizeAnnouncement(item, { isRead: readIds.has(item._id) })
    ),
    pagination: buildPaginationMeta({
      page: safePage,
      limit: safeLimit,
      total,
    }),
  };
};

const getMyAnnouncement = async (user, announcementId) => {
  if (user.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employees can use this endpoint');
  }

  const announcement = await Announcement.findOne({
    _id: announcementId,
    isActive: true,
  });

  if (!announcement) {
    throw new ApiError(404, 'Announcement not found');
  }

  const readRow = await AnnouncementRead.findOne({
    announcementId,
    userId: user._id,
  });

  return sanitizeAnnouncement(announcement, { isRead: Boolean(readRow) });
};

const markAnnouncementRead = async (user, announcementId) => {
  if (user.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employees can use this endpoint');
  }

  const announcement = await Announcement.findOne({
    _id: announcementId,
    isActive: true,
  });

  if (!announcement) {
    throw new ApiError(404, 'Announcement not found');
  }

  await AnnouncementRead.updateOne(
    { announcementId, userId: user._id },
    { $set: { readAt: new Date() } },
    { upsert: true }
  );

  return sanitizeAnnouncement(announcement, { isRead: true });
};

const getUnreadCount = async (user) => {
  if (user.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employees can use this endpoint');
  }

  const readIds = await AnnouncementRead.find({ userId: user._id }).distinct(
    'announcementId'
  );

  return Announcement.countDocuments({
    isActive: true,
    _id: { $nin: readIds },
  });
};

module.exports = {
  listAnnouncementsForAdmin,
  createAnnouncement,
  deleteAnnouncement,
  listMyAnnouncements,
  getMyAnnouncement,
  markAnnouncementRead,
  getUnreadCount,
};
