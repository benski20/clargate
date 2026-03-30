import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts";

export function generateS3Key(proposalId: string, fileName: string): string {
  const unique = crypto.randomUUID().slice(0, 8);
  return `proposals/${proposalId}/${unique}_${fileName}`;
}

export function createPresignedUploadUrl(s3Key: string): string {
  return getSignedUrl({
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    bucket: Deno.env.get("S3_BUCKET_NAME")!,
    key: s3Key,
    region: Deno.env.get("AWS_DEFAULT_REGION") || "us-east-1",
    method: "PUT",
    expiresIn: 3600,
  });
}

export function createPresignedDownloadUrl(s3Key: string): string {
  return getSignedUrl({
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    bucket: Deno.env.get("S3_BUCKET_NAME")!,
    key: s3Key,
    region: Deno.env.get("AWS_DEFAULT_REGION") || "us-east-1",
    method: "GET",
    expiresIn: 3600,
  });
}
