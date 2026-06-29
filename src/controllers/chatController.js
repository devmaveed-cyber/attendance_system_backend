const chatService = require('../services/chatService');

const getIo = (req) => req.app.get('io');

const emitToConversation = (req, conversationId, event, payload) => {
  const io = getIo(req);
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
};

const emitConversationUpdatedToAdmins = (req, conversation) => {
  const io = getIo(req);
  if (!io) return;
  io.to('chat:admins').emit('chat:conversation_updated', conversation);
};

const emitChatMessage = (req, conversationId, payload) => {
  emitToConversation(req, conversationId, 'chat:message', payload);
  emitConversationUpdatedToAdmins(req, payload.conversation);
};

const listConversations = async (req, res) => {
  const conversations = await chatService.listConversations(req.user);

  res.status(200).json({
    success: true,
    data: { conversations },
  });
};

const openSupportConversation = async (req, res) => {
  const conversation = await chatService.getOrCreateSupportConversation(req.user);

  res.status(200).json({
    success: true,
    data: { conversation },
  });
};

const getConversation = async (req, res) => {
  const conversation = await chatService.getConversation(
    req.user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data: { conversation },
  });
};

const getMessages = async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 50;

  const result = await chatService.getMessages(req.user, req.params.id, {
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
};

const sendMessage = async (req, res) => {
  const conversationId = req.params.id;

  const result = await chatService.sendMessage(
    req.user,
    conversationId,
    req.body.text,
    (payload) => emitChatMessage(req, conversationId, payload)
  );

  res.status(201).json({
    success: true,
    message: 'Message sent',
    data: result,
  });
};

const sendEmployeeMessage = async (req, res) => {
  await chatService.getOrCreateSupportConversation(req.user);
  const conversationId = chatService.supportConversationId(req.user._id);

  const result = await chatService.sendMessage(
    req.user,
    conversationId,
    req.body.text,
    (payload) => emitChatMessage(req, conversationId, payload)
  );

  res.status(201).json({
    success: true,
    message: 'Message sent',
    data: result,
  });
};

const markRead = async (req, res) => {
  const conversation = await chatService.markConversationRead(
    req.user,
    req.params.id,
    (payload) => emitConversationUpdatedToAdmins(req, payload)
  );

  res.status(200).json({
    success: true,
    data: { conversation },
  });
};

const getUnreadCount = async (req, res) => {
  const unreadCount = await chatService.getUnreadCount(req.user);

  res.status(200).json({
    success: true,
    data: { unreadCount },
  });
};

module.exports = {
  listConversations,
  openSupportConversation,
  getConversation,
  getMessages,
  sendMessage,
  sendEmployeeMessage,
  markRead,
  getUnreadCount,
};
