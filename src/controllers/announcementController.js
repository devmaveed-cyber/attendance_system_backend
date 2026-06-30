const announcementService = require('../services/announcementService');

const listAnnouncements = async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 25;
  const search = req.query.search?.toString() || '';

  const result = await announcementService.listAnnouncementsForAdmin(req.user, {
    page,
    limit,
    search,
  });

  res.status(200).json({
    success: true,
    count: result.announcements.length,
    data: result,
  });
};

const createAnnouncement = async (req, res) => {
  const result = await announcementService.createAnnouncement(req.user, {
    title: req.body.title,
    body: req.body.body,
  });

  res.status(201).json({
    success: true,
    message: 'Announcement published. Notifications are being sent in the background.',
    data: result,
  });
};

const deleteAnnouncement = async (req, res) => {
  const announcement = await announcementService.deleteAnnouncement(
    req.user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    message: 'Announcement removed',
    data: { announcement },
  });
};

const listMyAnnouncements = async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 25;

  const result = await announcementService.listMyAnnouncements(req.user, {
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    count: result.announcements.length,
    data: result,
  });
};

const getMyAnnouncement = async (req, res) => {
  const announcement = await announcementService.getMyAnnouncement(
    req.user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data: { announcement },
  });
};

const markRead = async (req, res) => {
  const announcement = await announcementService.markAnnouncementRead(
    req.user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data: { announcement },
  });
};

const getUnreadCount = async (req, res) => {
  const unreadCount = await announcementService.getUnreadCount(req.user);

  res.status(200).json({
    success: true,
    data: { unreadCount },
  });
};

module.exports = {
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  listMyAnnouncements,
  getMyAnnouncement,
  markRead,
  getUnreadCount,
};
