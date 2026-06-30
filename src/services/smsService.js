const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const extractMessageAckError = (response) => {
  const ack = response?.messageack;
  if (!ack || typeof ack !== 'object') return null;

  const guids = ack.guids;
  if (!Array.isArray(guids)) return null;

  for (const entry of guids) {
    if (!entry || typeof entry !== 'object') continue;
    const errors = entry.errors;
    if (!Array.isArray(errors) || errors.length === 0) continue;

    const first = errors[0];
    if (first && typeof first === 'object') {
      const text = String(first.errortext || '').trim();
      if (text) return text;
    }
    return 'SMS gateway rejected the message';
  }

  return null;
};

const sendSms = async ({ toNumber, messageText, messageId }) => {
  if (!env.sms.isConfigured) {
    if (env.nodeEnv !== 'production') {
      console.warn(`[smsService] SMS not configured — would send to ${toNumber}: ${messageText}`);
      return { status: 'Success' };
    }
    throw new ApiError(503, 'SMS service is not configured');
  }

  const url = `${env.sms.baseUrl}${env.sms.sendSmsEndpoint}`;
  const payload = {
    apiver: '1.0',
    sms: {
      ver: '2.0',
      dlr: { url: '' },
      messages: [
        {
          udh: '0',
          coding: 1,
          text: messageText,
          property: 0,
          id: messageId,
          addresses: [
            {
              from: env.sms.senderId,
              to: toNumber,
              seq: '1',
              tag: 'OTP Verification',
            },
          ],
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-id': env.sms.clientId,
      'x-client-password': env.sms.clientPassword,
    },
    body: JSON.stringify(payload),
  });

  let body = {};
  if (response.body) {
    try {
      body = await response.json();
    } catch {
      body = {};
    }
  }

  const ackError = extractMessageAckError(body);
  if (ackError) {
    throw new ApiError(502, `Failed to send OTP: ${ackError}`);
  }

  const status = String(body.status || '').toLowerCase();
  if (status !== 'success' && response.status !== 200) {
    const detail = body.statustext || body.status || response.statusText;
    throw new ApiError(502, `Failed to send OTP: ${detail}`);
  }

  return body;
};

const sendOtpSms = async (phone, otp) => {
  const messageId = `otp_${phone}_${Date.now()}`;
  await sendSms({
    toNumber: phone,
    messageText: `Your password reset code is ${otp}. This code will expire in 5 minutes.`,
    messageId,
  });
};

module.exports = {
  sendSms,
  sendOtpSms,
};
