import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function generateS3Key(proposalId: string, fileName: string): string {
  const unique = crypto.randomUUID().slice(0, 8);
  return `proposals/${proposalId}/${unique}_${fileName}`;
}

/** Stored institutional AI guidance files (admin uploads). */
export function generateInstitutionGuidanceS3Key(
  institutionId: string,
  guidanceId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[/\\]/g, "_").slice(0, 200);
  return `institutions/${institutionId}/ai-guidance/${guidanceId}/${safe}`;
}

export function getS3Client(): S3Client {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY");
  }
  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function getBucketName(): string {
  const b = process.env.S3_BUCKET_NAME;
  if (!b) throw new Error("Missing S3_BUCKET_NAME");
  return b;
}

export async function putObjectToS3(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

export async function deleteObjectFromS3(key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
  );
}

/** Short-lived URL for browser download (GET object). */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const client = getS3Client();
  const cmd = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  return getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
}
