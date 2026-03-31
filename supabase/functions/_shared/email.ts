export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<boolean> {
  const sender = Deno.env.get("SES_SENDER_EMAIL") || "noreply@aribter.com";
  const region = Deno.env.get("SES_REGION") || "us-east-1";
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;

  const params = new URLSearchParams({
    Action: "SendEmail",
    Source: sender,
    "Destination.ToAddresses.member.1": to,
    "Message.Subject.Data": subject,
    "Message.Body.Html.Data": htmlBody,
    Version: "2010-12-01",
  });

  const endpoint = `https://email.${region}.amazonaws.com/`;
  const body = params.toString();
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 8);

  try {
    const { AwsClient } = await import("https://esm.sh/aws4fetch@1.0.20");
    const client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
      service: "ses",
    });

    const res = await client.fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return res.ok;
  } catch (e) {
    console.error("SES send failed:", e);
    return false;
  }
}

export async function sendReviewerAssignment(
  to: string,
  reviewerName: string,
  proposalTitle: string,
): Promise<boolean> {
  const html = `
    <h2>New Review Assignment</h2>
    <p>Dear ${reviewerName},</p>
    <p>You have been assigned to review: <strong>${proposalTitle}</strong></p>
    <p>Please log in to the Arbiter platform to begin your review.</p>
  `;
  return sendEmail(to, `New Review Assignment: ${proposalTitle}`, html);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Notifies the PI that a revision letter is available in-app (plain body, HTML-safe). */
export async function sendRevisionLetterToPi(
  to: string,
  piName: string,
  proposalTitle: string,
  letterBody: string,
): Promise<boolean> {
  const safe = escapeHtml(letterBody);
  const html = `
    <h2>Revision request</h2>
    <p>Dear ${escapeHtml(piName || "Investigator")},</p>
    <p>Your IRB office has shared revision feedback for <strong>${escapeHtml(proposalTitle)}</strong>.</p>
    <p>Please sign in to Arbiter to view the full letter and respond.</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:16px 0" />
    <pre style="font-family:system-ui,sans-serif;font-size:14px;white-space:pre-wrap;margin:0">${safe}</pre>
  `;
  return sendEmail(to, `Revision request: ${proposalTitle}`, html);
}
