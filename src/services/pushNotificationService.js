const admin = require('firebase-admin');
const User = require('../models/User');

let initialized = false;

const initFirebaseAdmin = () => {
  if (initialized) return true;

  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    return false;
  }

  try {
    const serviceAccount = JSON.parse(rawJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    return false;
  }
};

const isEnabled = () => initFirebaseAdmin();

const removeInvalidTokens = async (userId, tokens) => {
  if (!tokens.length) return;

  await User.updateOne(
    { _id: userId },
    { $pull: { fcmTokens: { token: { $in: tokens } } } }
  );
};

const buildAndroidConfig = (channelId) => ({
  priority: 'high',
  notification: {
    channelId,
    sound: 'default',
  },
});

const processMulticastResponse = async (response, tokens, tokenOwners) => {
  const alwaysPruneCodes = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
  ]);
  const envMismatchCodes = new Set([
    'messaging/third-party-auth-error',
    'messaging/mismatched-credential',
  ]);

  const hadSuccess = response.successCount > 0;
  const invalidByUser = new Map();

  response.responses.forEach((result, index) => {
    if (result.success) return;

    const code = result.error?.code;
    if (
      alwaysPruneCodes.has(code) ||
      (hadSuccess && envMismatchCodes.has(code))
    ) {
      const token = tokens[index];
      const owners = tokenOwners.get(token) || [];
      owners.forEach((userId) => {
        if (!invalidByUser.has(userId)) invalidByUser.set(userId, []);
        invalidByUser.get(userId).push(token);
      });
    }
  });

  await Promise.all(
    [...invalidByUser.entries()].map(([userId, invalidTokens]) =>
      removeInvalidTokens(userId, invalidTokens)
    )
  );

  return {
    sent: response.successCount,
    failed: response.failureCount,
  };
};

const sendToUserTokens = async (
  userId,
  { title, body, data = {}, androidChannelId = 'hr_chat_messages' }
) => {
  if (!isEnabled()) return { sent: 0, skipped: true };

  const user = await User.findById(userId).select('fcmTokens');
  if (!user?.fcmTokens?.length) return { sent: 0, skipped: false };

  const tokens = [...new Set(user.fcmTokens.map((entry) => entry.token).filter(Boolean))];
  if (!tokens.length) return { sent: 0, skipped: false };

  const stringData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')])
  );

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: stringData,
    android: buildAndroidConfig(androidChannelId),
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
        'apns-topic': 'com.ecodrive.attendancemanagement',
      },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
        },
      },
    },
  });

  // Always-prune codes: the token is permanently dead and should be removed.
  const alwaysPruneCodes = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
  ]);

  // Conditional-prune codes: usually an APNs sandbox/production environment
  // mismatch for a specific token (e.g. a debug-build token after the build was
  // replaced). These are only safe to remove when at least one other token in
  // the same batch succeeded — that proves the APNs credentials themselves are
  // valid and the failure is token-specific, not a global auth outage.
  const envMismatchCodes = new Set([
    'messaging/third-party-auth-error',
    'messaging/mismatched-credential',
  ]);

  const hadSuccess = response.successCount > 0;
  const invalidTokens = [];
  const failures = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;

    const code = result.error?.code;
    failures.push({ code, message: result.error?.message });
    if (
      alwaysPruneCodes.has(code) ||
      (hadSuccess && envMismatchCodes.has(code))
    ) {
      invalidTokens.push(tokens[index]);
    }
  });

  if (failures.length) {
    console.error(
      `FCM push failures for user ${userId}:`,
      JSON.stringify(failures)
    );
  }

  if (invalidTokens.length) {
    await removeInvalidTokens(userId, invalidTokens);
  }

  return {
    sent: response.successCount,
    failed: response.failureCount,
    skipped: false,
  };
};

const notifyEmployeeChatMessage = async ({
  employeeId,
  senderName,
  text,
  conversationId,
}) => {
  const preview = String(text || '').trim();
  const body =
    preview.length > 120 ? `${preview.slice(0, 117)}...` : preview || 'New message from HR';

  return sendToUserTokens(employeeId, {
    title: senderName ? `HR: ${senderName}` : 'New HR message',
    body,
    data: {
      type: 'chat',
      conversationId: String(conversationId),
    },
  });
};

const notifyAllEmployeesAnnouncement = async ({ title, body, announcementId }) => {
  if (!isEnabled()) {
    return { sent: 0, skipped: true, recipients: 0 };
  }

  const employees = await User.find({
    accountRole: 'employee',
    isActive: true,
    'fcmTokens.0': { $exists: true },
  }).select('_id fcmTokens');

  const preview = String(body || '').trim();
  const notificationBody =
    preview.length > 160 ? `${preview.slice(0, 157)}...` : preview || 'New HR announcement';
  const notificationTitle = String(title || 'HR Announcement').trim();
  const stringData = {
    type: 'announcement',
    announcementId: String(announcementId),
  };

  const tokenOwners = new Map();
  const tokens = [];

  employees.forEach((employee) => {
    const uniqueForUser = new Set(
      (employee.fcmTokens || []).map((entry) => entry.token).filter(Boolean)
    );

    uniqueForUser.forEach((token) => {
      tokens.push(token);
      if (!tokenOwners.has(token)) {
        tokenOwners.set(token, []);
      }
      tokenOwners.get(token).push(employee._id);
    });
  });

  const uniqueTokens = [...new Set(tokens)];
  if (!uniqueTokens.length) {
    return { sent: 0, failed: 0, recipients: employees.length, skipped: false };
  }

  let sent = 0;
  let failed = 0;
  const batchSize = 500;

  for (let index = 0; index < uniqueTokens.length; index += batchSize) {
    const batch = uniqueTokens.slice(index, index + batchSize);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batch,
      notification: { title: notificationTitle, body: notificationBody },
      data: stringData,
      android: buildAndroidConfig('hr_announcements'),
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
          'apns-topic': 'com.ecodrive.attendancemanagement',
        },
        payload: {
          aps: {
            alert: { title: notificationTitle, body: notificationBody },
            sound: 'default',
            badge: 1,
          },
        },
      },
    });

    const summary = await processMulticastResponse(response, batch, tokenOwners);
    sent += summary.sent;
    failed += summary.failed;
  }

  return {
    sent,
    failed,
    recipients: employees.length,
    skipped: false,
  };
};

const queueAnnouncementPush = ({ title, body, announcementId }) => {
  setImmediate(() => {
    notifyAllEmployeesAnnouncement({ title, body, announcementId })
      .then((summary) => {
        console.log(
          `Announcement push queued for ${announcementId}:`,
          JSON.stringify(summary)
        );
      })
      .catch((error) => {
        console.error(
          `Announcement push failed for ${announcementId}:`,
          error.message
        );
      });
  });
};

module.exports = {
  isEnabled,
  notifyEmployeeChatMessage,
  notifyAllEmployeesAnnouncement,
  queueAnnouncementPush,
  sendToUserTokens,
};
