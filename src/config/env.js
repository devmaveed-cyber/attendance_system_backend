const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

const smsClientId = process.env.SMS_CLIENT_ID?.trim() || '';
const smsClientPassword = process.env.SMS_CLIENT_PASSWORD?.trim() || '';
const smsSenderId = process.env.SMS_SENDER_ID?.trim() || '';

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  allowPublicRegister: process.env.DISABLE_PUBLIC_REGISTER !== 'true',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  sms: {
    baseUrl: process.env.SMS_BASE_URL?.trim() || 'https://meapi.goinfinito.me',
    sendSmsEndpoint:
      process.env.SMS_SEND_ENDPOINT?.trim() || '/unified/v2/send',
    clientId: smsClientId,
    clientPassword: smsClientPassword,
    senderId: smsSenderId,
    isConfigured:
      smsClientId.length > 0 &&
      smsClientPassword.length > 0 &&
      smsSenderId.length > 0,
  },
};
