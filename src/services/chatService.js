const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');
const ApiError = require('../utils/ApiError');
const { resolveAllowedSections } = require('./authService');
const {
  sanitizeConversation,
  sanitizeMessage,
} = require('../utils/chatPresenter');
const pushNotificationService = require('./pushNotificationService');

const supportConversationId = (employeeId) => `support_${String(employeeId).trim()}`;

const mapGet = (mapLike, key, fallback = 0) => {
  if (!mapLike) return fallback;
  if (mapLike instanceof Map) {
    return mapLike.get(key) ?? fallback;
  }
  return mapLike[key] ?? fallback;
};

const mapSet = (target, key, value) => {
  if (target instanceof Map) {
    target.set(key, value);
    return;
  }
  target[key] = value;
};

const assertAdminChatAccess = async (user) => {
  if (user.accountRole === 'employee') {
    throw new ApiError(403, 'Employee accounts use the mobile app for chat');
  }

  const allowed = await resolveAllowedSections(user);
  if (!allowed.includes('chat')) {
    throw new ApiError(403, 'You do not have permission to access chat');
  }
};

const assertConversationAccess = async (user, conversation) => {
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  if (user.accountRole === 'employee') {
    if (conversation.employeeId !== user._id) {
      throw new ApiError(403, 'Access denied');
    }
    return;
  }

  await assertAdminChatAccess(user);
};

const touchParticipant = (conversation, user) => {
  const userId = user._id;
  const userName = user.name?.trim() || userId;

  if (!conversation.participantIds.includes(userId)) {
    conversation.participantIds.push(userId);
  }

  mapSet(conversation.participantNamesByUserId, userId, userName);

  if (mapGet(conversation.unreadCountByUserId, userId, null) === null) {
    mapSet(conversation.unreadCountByUserId, userId, 0);
  }
};

const listConversations = async (user) => {
  if (user.accountRole === 'employee') {
    const conversation = await ChatConversation.findById(
      supportConversationId(user._id)
    );
    return conversation ? [sanitizeConversation(conversation)] : [];
  }

  await assertAdminChatAccess(user);

  const conversations = await ChatConversation.find({ type: 'support' })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(200);

  return conversations.map(sanitizeConversation);
};

const getOrCreateSupportConversation = async (employee) => {
  if (employee.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employees can open support chat');
  }

  const conversationId = supportConversationId(employee._id);
  let conversation = await ChatConversation.findById(conversationId);

  if (!conversation) {
    conversation = await ChatConversation.create({
      _id: conversationId,
      type: 'support',
      employeeId: employee._id,
      employeeName: employee.name?.trim() || employee._id,
      participantIds: [employee._id],
      participantNamesByUserId: {
        [employee._id]: employee.name?.trim() || employee._id,
      },
      unreadCountByUserId: {
        [employee._id]: 0,
      },
      lastMessageText: '',
      lastMessageBy: '',
      lastMessageAt: null,
    });
  } else if (conversation.employeeName !== employee.name) {
    conversation.employeeName = employee.name?.trim() || employee._id;
    mapSet(
      conversation.participantNamesByUserId,
      employee._id,
      employee.name?.trim() || employee._id
    );
    await conversation.save();
  }

  return sanitizeConversation(conversation);
};

const getConversation = async (user, conversationId) => {
  const conversation = await ChatConversation.findById(conversationId);
  await assertConversationAccess(user, conversation);
  return sanitizeConversation(conversation);
};

const getMessages = async (user, conversationId, { page = 1, limit = 50 } = {}) => {
  const conversation = await ChatConversation.findById(conversationId);
  await assertConversationAccess(user, conversation);

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const [messages, total] = await Promise.all([
    ChatMessage.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    ChatMessage.countDocuments({ conversationId }),
  ]);

  return {
    messages: messages.reverse().map(sanitizeMessage),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

const sendMessage = async (user, conversationId, text, emit) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new ApiError(400, 'Message text is required');
  }

  let conversation = await ChatConversation.findById(conversationId);

  if (!conversation && user.accountRole === 'employee') {
    await getOrCreateSupportConversation(user);
    conversation = await ChatConversation.findById(conversationId);
  }

  await assertConversationAccess(user, conversation);

  touchParticipant(conversation, user);

  const senderRole = user.accountRole === 'employee' ? 'employee' : 'admin';
  const message = await ChatMessage.create({
    conversationId,
    senderId: user._id,
    senderRole,
    senderName: user.name?.trim() || user._id,
    text: trimmed,
  });

  conversation.lastMessageText = trimmed;
  conversation.lastMessageBy = user._id;
  conversation.lastMessageAt = message.createdAt;

  const recipients = new Set(conversation.participantIds);
  recipients.add(conversation.employeeId);

  recipients.forEach((participantId) => {
    if (participantId === user._id) {
      mapSet(conversation.unreadCountByUserId, participantId, 0);
      return;
    }

    const current = mapGet(conversation.unreadCountByUserId, participantId, 0);
    mapSet(conversation.unreadCountByUserId, participantId, current + 1);
  });

  await conversation.save();

  const payload = {
    conversation: sanitizeConversation(conversation),
    message: sanitizeMessage(message),
  };

  if (typeof emit === 'function') {
    emit(payload);
  }

  if (senderRole === 'admin' && conversation.employeeId) {
    pushNotificationService
      .notifyEmployeeChatMessage({
        employeeId: conversation.employeeId,
        senderName: user.name?.trim() || user._id,
        text: trimmed,
        conversationId,
      })
      .catch((error) => {
        console.error('Failed to send chat push notification:', error.message);
      });
  }

  return payload;
};

const markConversationRead = async (user, conversationId, emit) => {
  const conversation = await ChatConversation.findById(conversationId);
  await assertConversationAccess(user, conversation);

  mapSet(conversation.unreadCountByUserId, user._id, 0);
  await conversation.save();

  const payload = sanitizeConversation(conversation);

  if (typeof emit === 'function') {
    emit(payload);
  }

  return payload;
};

const getUnreadCount = async (user) => {
  if (user.accountRole === 'employee') {
    const conversation = await ChatConversation.findById(
      supportConversationId(user._id)
    );
    if (!conversation) return 0;
    return mapGet(conversation.unreadCountByUserId, user._id, 0);
  }

  await assertAdminChatAccess(user);

  const conversations = await ChatConversation.find({ type: 'support' }).select(
    'unreadCountByUserId'
  );

  return conversations.reduce(
    (sum, conversation) =>
      sum + mapGet(conversation.unreadCountByUserId, user._id, 0),
    0
  );
};

module.exports = {
  supportConversationId,
  listConversations,
  getOrCreateSupportConversation,
  getConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
};
