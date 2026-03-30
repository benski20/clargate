/** In-browser text extraction + Gemini (not multipart S3). “50 GB” single-file requires a different pipeline. */
export const MAX_INGEST_BYTES_PER_FILE = 100 * 1024 * 1024; // 100 MB

export const MAX_UPLOAD_ATTACHMENTS_CHAT = 12;
export const MAX_UPLOAD_ATTACHMENTS_MATERIALS = 32;
