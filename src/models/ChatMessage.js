const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ['admin', 'employee'],
      required: true,
    },
    senderName: {
      type: String,
      trim: true,
      default: '',
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
