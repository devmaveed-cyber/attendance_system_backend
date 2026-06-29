const sanitizeConversation = (conversation) => ({
  conversationId: conversation._id,
  type: conversation.type,
  employeeId: conversation.employeeId,
  employeeName: conversation.employeeName,
  participantIds: conversation.participantIds || [],
  participantNamesByUserId: mapToObject(conversation.participantNamesByUserId),
  unreadCountByUserId: mapToObject(conversation.unreadCountByUserId),
  lastMessageText: conversation.lastMessageText || '',
  lastMessageBy: conversation.lastMessageBy || '',
  lastMessageAt: conversation.lastMessageAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const sanitizeMessage = (message) => ({
  messageId: message._id.toString(),
  conversationId: message.conversationId,
  senderId: message.senderId,
  senderRole: message.senderRole,
  senderName: message.senderName,
  text: message.text,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const mapToObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  return { ...value };
};

module.exports = {
  sanitizeConversation,
  sanitizeMessage,
};
