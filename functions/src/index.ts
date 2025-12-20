/**
 * Cloud Functions for Nuti
 * 
 * Functions for sending emails and other server-side operations
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Resend } from "resend";

// Import new modules
import { checkRateLimit, cleanupRateLimits, monitorRateLimits } from "./rateLimit";
import { cleanupOldData, deleteUserData, exportUserData, cleanupOldMessages } from "./dataRetention";
import { performanceMonitor, dailySummary, healthCheck, logEvent, withLogging } from "./monitoring";

// Initialize Firebase Admin
admin.initializeApp();

// Note: RESEND_API_KEY will be available in process.env.RESEND_API_KEY
// after it's configured as a secret in the function definition

/**
 * Send account deletion confirmation email
 * 
 * This is a callable function that can be called from the client app
 * 
 * IMPORTANT: The RESEND_API_KEY secret must be configured before deploying:
 * firebase functions:secrets:set RESEND_API_KEY
 */
export const sendAccountDeletionEmail = functions
    .runWith({
      secrets: ["RESEND_API_KEY"],
    })
    .https.onCall(async (data: { email: string; userName?: string }, context: functions.https.CallableContext) => {
      // Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User must be authenticated to delete account"
        );
      }

      const userId = context.auth.uid;
      const { email, userName } = data;

      if (!email) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Email is required"
        );
      }

      try {
        // Get Resend API key from secrets
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          throw new Error("RESEND_API_KEY secret is not configured");
        }

        const resend = new Resend(resendApiKey);
        const deletionDate = new Date().toISOString();
        
        // Send email using Resend
        const emailResult = await resend.emails.send({
          from: "Nuti <support@nuti.app>", // Update with your verified domain
          to: email,
          subject: "Account Deletion Confirmation - Nuti",
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Account Deletion Confirmation</title>
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
                  <h1 style="color: #4a5568; margin-top: 0;">Account Deletion Confirmation</h1>
                  
                  <p>Hello${userName ? ` ${userName}` : ""},</p>
                  
                  <p>This email confirms that your Nuti account has been successfully deleted.</p>
                  
                  <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #EF4444;">
                    <h2 style="margin-top: 0; color: #EF4444;">Account Information</h2>
                    <p style="margin: 5px 0;"><strong>Account ID:</strong> ${userId}</p>
                    <p style="margin: 5px 0;"><strong>Deletion Date:</strong> ${new Date(deletionDate).toLocaleString()}</p>
                  </div>
                  
                  <p>All your personal data has been permanently removed from our systems in accordance with GDPR requirements. This includes:</p>
                  
                  <ul>
                    <li>Your calorie tracking history</li>
                    <li>Your progress, goals, and weight records</li>
                    <li>All your meal and exercise data</li>
                    <li>Your chat history and interactions</li>
                    <li>Your profile information</li>
                  </ul>
                  
                  <p style="background-color: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; margin: 20px 0;">
                    <strong>⚠️ Important:</strong> If you did not request this deletion, please contact us immediately at <a href="mailto:support@nuti.app" style="color: #EF4444;">support@nuti.app</a>
                  </p>
                  
                  <p>We're sorry to see you go. If you change your mind, you can always create a new account.</p>
                  
                  <p>Best regards,<br>The Nuti Team</p>
                  
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                  
                  <p style="font-size: 12px; color: #6b7280; text-align: center;">
                    This is an automated email. Please do not reply to this message.<br>
                    For support, contact us at <a href="mailto:support@nuti.app" style="color: #EF4444;">support@nuti.app</a>
                  </p>
                </div>
              </body>
            </html>
          `,
          text: `
Account Deletion Confirmation - Nuti

Hello${userName ? ` ${userName}` : ""},

This email confirms that your Nuti account has been successfully deleted.

Account Information:
- Account ID: ${userId}
- Deletion Date: ${new Date(deletionDate).toLocaleString()}

All your personal data has been permanently removed from our systems in accordance with GDPR requirements. This includes:
- Your calorie tracking history
- Your progress, goals, and weight records
- All your meal and exercise data
- Your chat history and interactions
- Your profile information

⚠️ Important: If you did not request this deletion, please contact us immediately at support@nuti.app

We're sorry to see you go. If you change your mind, you can always create a new account.

Best regards,
The Nuti Team

---
This is an automated email. Please do not reply to this message.
For support, contact us at support@nuti.app
          `,
        });

        if (emailResult.error) {
          console.error("Resend error:", emailResult.error);
          throw new functions.https.HttpsError(
              "internal",
              "Failed to send email",
              emailResult.error
          );
        }

        return {
          success: true,
          messageId: emailResult.data?.id,
        };
      } catch (error: any) {
        console.error("Error sending deletion email:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to send account deletion email",
            error.message
        );
      }
    }
);

/**
 * Export all Cloud Functions
 */

// Rate Limiting functions
export { cleanupRateLimits, monitorRateLimits };

// Data Retention & GDPR functions  
export { cleanupOldData, deleteUserData, exportUserData, cleanupOldMessages };

// Monitoring & Logging functions
export { performanceMonitor, dailySummary, healthCheck };

// Utility exports
export { logEvent, withLogging, checkRateLimit };


