import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Server-only: same behavior as Supabase Edge `sendReviewerAssignment` (SES).
 */
export async function sendReviewerAssignmentEmail(
  to: string,
  reviewerName: string,
  proposalTitle: string,
): Promise<boolean> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    console.warn("sendReviewerAssignmentEmail: missing AWS credentials, skipping email");
    return false;
  }

  const region = process.env.SES_REGION || "us-east-1";
  const sender = process.env.SES_SENDER_EMAIL || "noreply@aribter.com";

  const client = new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const safeName = escapeHtml(reviewerName);
  const safeTitle = escapeHtml(proposalTitle);
  const html = `
    <h2>New Review Assignment</h2>
    <p>Dear ${safeName},</p>
    <p>You have been assigned to review: <strong>${safeTitle}</strong></p>
    <p>Please log in to the Arbiter platform to begin your review.</p>
  `;

  try {
    await client.send(
      new SendEmailCommand({
        Source: sender,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: {
            Data: `New Review Assignment: ${proposalTitle}`,
            Charset: "UTF-8",
          },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
        },
      }),
    );
    return true;
  } catch (e) {
    console.error("SES sendReviewerAssignmentEmail failed:", e);
    return false;
  }
}
