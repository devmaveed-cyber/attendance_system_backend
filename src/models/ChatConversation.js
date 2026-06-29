const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    type: {
      type: String,
      enum: ['support'],
      default: 'support',
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    employeeName: {
      type: String,
      trim: true,
      default: '',
    },
    participantIds: {
      type: [String],
      default: [],
    },
    participantNamesByUserId: {
      type: Map,
      of: String,
      default: {},
    },
    unreadCountByUserId: {
      type: Map,
      of: Number,
      default: {},
    },
    lastMessageText: {
      type: String,
      trim: true,
      default: '',
    },
    lastMessageBy: {
      type: String,
      trim: true,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

chatConversationSchema.index({ lastMessageAt: -1 });
chatConversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
