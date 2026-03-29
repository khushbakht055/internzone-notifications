# InternZone Notification Server

Simple Node.js backend for sending FCM push notifications.

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Add Firebase service account:**
   - Download from Firebase Console → Settings → Service Accounts → Generate new private key
   - Save as `serviceAccountKey.json` in this folder

3. **Run the server:**
   ```bash
   npm start
   ```

4. **Test:**
   ```
   http://localhost:3000
   ```

## Deploy to DigitalOcean App Platform

1. Push this folder to GitHub
2. Go to DigitalOcean → Apps → Create App
3. Select your GitHub repo
4. Add environment variable:
   - `FIREBASE_SERVICE_ACCOUNT_BASE64` = your base64 encoded service account
5. Deploy!

Your URL will be: `https://your-app-name.ondigitalocean.app`

## API Endpoint

**POST /send**

```json
{
  "type": "message",
  "data": {
    "recipientId": "user123",
    "senderName": "John",
    "messageText": "Hello!"
  }
}
```

Types: `message`, `session_booked`, `session_status`, `review`
