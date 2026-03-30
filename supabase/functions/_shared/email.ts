export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<boolean> {
  const sender = Deno.env.get("SES_SENDER_EMAIL") || "noreply@clargate.com";
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
    <p>Please log in to the Clargate platform to begin your review.</p>
  `;
  return sendEmail(to, `New Review Assignment: ${proposalTitle}`, html);
}
