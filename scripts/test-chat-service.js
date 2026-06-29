#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const chatService = require('../src/services/chatService');
const Group = require('../src/models/Group');
const User = require('../src/models/User');
const ChatMessage = require('../src/models/ChatMessage');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function findAdminWithChatAccess() {
  const groups = await Group.find({ sections: 'chat' }).select('_id name sections');
  const groupIds = groups.map((group) => group._id);

  if (groupIds.length === 0) {
    return User.findOne({ accountRole: 'admin', isActive: true });
  }

  return User.findOne({
    accountRole: 'admin',
    isActive: true,
    groupId: { $in: groupIds },
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const employee = await User.findOne({ accountRole: 'employee', isActive: true });
  assert(employee, 'No active employee found in database');

  const admin = await findAdminWithChatAccess();
  assert(admin, 'No active admin found for chat tests');

  const testText = `Automated chat service test ${Date.now()}`;
  const replyText = `Automated HR reply ${Date.now()}`;

  const conversation = await chatService.getOrCreateSupportConversation(employee);
  assert(
    conversation.conversationId === `support_${employee._id}`,
    'Support conversation id mismatch'
  );
  console.log('OK support conversation:', conversation.conversationId);

  const employeeSend = await chatService.sendMessage(
    employee,
    conversation.conversationId,
    testText
  );
  assert(employeeSend.message.text === testText, 'Employee message text mismatch');
  console.log('OK employee send message');

  const adminList = await chatService.listConversations(admin);
  assert(
    adminList.some((item) => item.conversationId === conversation.conversationId),
    'Admin inbox missing employee conversation'
  );
  console.log('OK admin list conversations');

  const adminSend = await chatService.sendMessage(
    admin,
    conversation.conversationId,
    replyText
  );
  assert(adminSend.message.text === replyText, 'Admin reply text mismatch');
  console.log('OK admin reply');

  const employeeUnread = await chatService.getUnreadCount(employee);
  assert(employeeUnread >= 1, 'Employee unread count should be >= 1');
  console.log('OK employee unread count:', employeeUnread);

  const messages = await chatService.getMessages(employee, conversation.conversationId, {
    page: 1,
    limit: 20,
  });
  assert(
    messages.messages.some((item) => item.text === testText),
    'Employee message history missing test message'
  );
  assert(
    messages.messages.some((item) => item.text === replyText),
    'Employee message history missing HR reply'
  );
  console.log('OK message history contains both messages');

  await chatService.markConversationRead(employee, conversation.conversationId);
  const unreadAfterRead = await chatService.getUnreadCount(employee);
  assert(unreadAfterRead === 0, 'Employee unread should be 0 after mark read');
  console.log('OK mark conversation read');

  const employeeOnlyList = await chatService.listConversations(employee);
  assert(employeeOnlyList.length === 1, 'Employee should see exactly one conversation');
  console.log('OK employee conversation list');

  // Cleanup test messages only (keep conversation shell).
  await ChatMessage.deleteMany({
    conversationId: conversation.conversationId,
    text: { $in: [testText, replyText] },
  });
  console.log('OK cleaned up test messages');

  console.log('PASS: chat service integration test');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('FAIL:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
