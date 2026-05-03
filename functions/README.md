
# Nuti Cloud Functions

Cloud Functions for Nuti server-side operations, including email delivery.

## 📋 Prerequisites

1. **Node.js 18+** installed
2. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   ```
3. **Resend API Key** - Create an account at [resend.com](https://resend.com) and obtain your API key

## 🚀 Setup

1. **Install dependencies:**
   ```bash
   cd functions
   npm install
   ```

2. **Configure environment variables:**
Copy the `.env.example` file to `.env` in the `functions/` folder and fill in your key:
```
cp .env.example .env
```
**Never commit your real `.env` file to a public repository!**

For production, configure directly in Firebase:
```bash
firebase functions:config:set resend.api_key="your-resend-api-key"
```

Or using the new syntax (Firebase CLI 10+):
```bash
firebase functions:secrets:set RESEND_API_KEY
```
(You will be prompted to enter the value)

3. **Verify domain in Resend:**
   - Go to [resend.com/domains](https://resend.com/domains)
   - Add and verify the domain `nuti.app`
   - Configure DNS records as instructed

## 🔨 Development

1. **Compile TypeScript:**
   ```bash
   npm run build
   ```

2. **Run local emulator (optional):**
   ```bash
   npm run serve
   ```

3. **View logs:**
   ```bash
   npm run logs
   ```

## 📤 Deploy

1. **Login to Firebase:**
   ```bash
   firebase login
   ```

2. **Deploy functions:**
   ```bash
   npm run deploy
   ```
   
   Or from the project root:
   ```bash
   firebase deploy --only functions
   ```

## 📧 Available Functions

### `sendAccountDeletionEmail`
Callable function that sends an account deletion confirmation email.

**Parameters:**
- `email` (string, required): User's email
- `userName` (string, optional): User's name

**Returns:**
- `success` (boolean): Whether the email was sent successfully
- `messageId` (string): Message ID in Resend

**Example usage on client:**
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendDeletionEmail = httpsCallable(functions, 'sendAccountDeletionEmail');

await sendDeletionEmail({
  email: 'user@example.com',
  userName: 'John Doe',
});
```

## 🔐 Security

- The function checks user authentication
- Only authenticated users can call the function
- The email is sent only to the authenticated user's email

## 📝 Notes

- The domain `hello@nuti.app` must be verified in Resend
- For production, configure environment variables via Firebase Functions config
- Resend offers a generous free tier (3000 emails/month)

