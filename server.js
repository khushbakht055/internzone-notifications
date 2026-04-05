const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let serviceAccount;

// Try environment variable (for DigitalOcean deployment)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    process.exit(1);
  }
} else {
  // Load from file for local development
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (e) {
    console.error('No Firebase service account found! Set FIREBASE_SERVICE_ACCOUNT env var or add serviceAccountKey.json');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const messaging = admin.messaging();

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'InternZone Notification Server' });
});

// Main notification endpoint
app.post('/send', async (req, res) => {
  console.log('📩 Incoming request:', JSON.stringify(req.body, null, 2));
  
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      console.log('❌ Missing type or data');
      return res.status(400).json({ error: 'Missing type or data' });
    }

    let result;

    switch (type) {
      case 'message':
        result = await sendMessageNotification(data);
        break;
      case 'session_booked':
        result = await sendSessionBookedNotification(data);
        break;
      case 'session_status':
        result = await sendSessionStatusNotification(data);
        break;
      case 'review':
        result = await sendReviewNotification(data);
        break;
      default:
        return res.status(400).json({ error: 'Unknown notification type' });
    }

    console.log('✅ Notification sent successfully:', result);
    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Send notification for new message
async function sendMessageNotification(data) {
  const { recipientId, senderName, senderImage, chatId, senderId, messageText } = data;

  const recipientDoc = await db.collection('users').doc(recipientId).get();
  if (!recipientDoc.exists) {
    throw new Error('Recipient not found');
  }

  const fcmToken = recipientDoc.data().fcmToken;
  if (!fcmToken) {
    throw new Error('No FCM token for recipient');
  }

  const payload = {
    notification: {
      title: senderName || 'New Message',
      body: messageText || 'Sent you a message',
    },
    data: {
      type: 'chat',
      chatId: chatId || '',
      otherUid: senderId || '',
      otherName: senderName || '',
      otherImage: senderImage || '',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    token: fcmToken,
  };

  return await messaging.send(payload);
}

// Send notification when session is booked
async function sendSessionBookedNotification(data) {
  const { counselorId, studentName, studentId, sessionId } = data;

  const counselorDoc = await db.collection('users').doc(counselorId).get();
  if (!counselorDoc.exists) {
    throw new Error('Counselor not found');
  }

  const fcmToken = counselorDoc.data().fcmToken;
  if (!fcmToken) {
    throw new Error('No FCM token for counselor');
  }

  const payload = {
    notification: {
      title: 'New Session Booking',
      body: `${studentName || 'A student'} has booked a session with you`,
    },
    data: {
      type: 'session_booking',
      sessionId: sessionId || '',
      studentId: studentId || '',
      studentName: studentName || '',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    token: fcmToken,
  };

  return await messaging.send(payload);
}

// Send notification when session status changes
async function sendSessionStatusNotification(data) {
  const { studentId, counselorName, status, sessionId, counselorId } = data;

  const studentDoc = await db.collection('users').doc(studentId).get();
  if (!studentDoc.exists) {
    throw new Error('Student not found');
  }

  const fcmToken = studentDoc.data().fcmToken;
  if (!fcmToken) {
    throw new Error('No FCM token for student');
  }

  let title = 'Session Update';
  let body = '';

  switch (status) {
    case 'CONFIRMED':
      title = 'Session Confirmed!';
      body = `${counselorName || 'Counselor'} has confirmed your session`;
      break;
    case 'CANCELLED':
      title = 'Session Cancelled';
      body = `Your session with ${counselorName || 'Counselor'} has been cancelled`;
      break;
    case 'COMPLETED':
      title = 'Session Completed';
      body = `Your session with ${counselorName || 'Counselor'} is complete. Leave a review!`;
      break;
    default:
      throw new Error('Unknown status');
  }

  const payload = {
    notification: { title, body },
    data: {
      type: 'session',
      sessionId: sessionId || '',
      status: status || '',
      counselorId: counselorId || '',
      counselorName: counselorName || '',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    token: fcmToken,
  };

  return await messaging.send(payload);
}

// Send notification for new review
async function sendReviewNotification(data) {
  const { counselorId, reviewerName, rating } = data;

  const counselorDoc = await db.collection('users').doc(counselorId).get();
  if (!counselorDoc.exists) {
    throw new Error('Counselor not found');
  }

  const fcmToken = counselorDoc.data().fcmToken;
  if (!fcmToken) {
    throw new Error('No FCM token for counselor');
  }

  const payload = {
    notification: {
      title: 'New Review',
      body: `${reviewerName || 'Someone'} gave you ${rating || 5} stars!`,
    },
    data: {
      type: 'review',
      reviewerName: reviewerName || '',
      rating: String(rating || 5),
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    token: fcmToken,
  };

  return await messaging.send(payload);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Notification server running on port ${PORT}`);
});
