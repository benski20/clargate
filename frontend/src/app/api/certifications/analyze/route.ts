import { NextRequest, NextResponse } from "next/server";
import {
  COMPLIANCE_CERTIFICATION_MAX_BYTES,
} from "@/lib/compliance-certifications";
import { requirePiAppUser } from "@/lib/require-pi-user-server";
import { extractCertificationMetadata } from "@/lib/server/openai-certification-vision";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * Step 1: analyze a certificate with Azure Foundry model-router — does not persist to S3 or Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePiAppUser();
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }
    if (file.size > COMPLIANCE_CERTIFICATION_MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 16 MB)" }, { status: 400 });
    }

    const fileName = file instanceof File && file.name ? file.name : "certificate.pdf";
    const fileType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(fileType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF or image (PNG, JPEG, WebP)." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extracted;
    try {
      extracted = await extractCertificationMetadata({
        buffer,
        mimeType: fileType,
        fileName,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      if (msg.includes("AZURE_ARBITER_ENDPOINT") || msg.includes("AZURE_OPENAI")) {
        return NextResponse.json(
          { error: "Certificate analysis is not configured. Check Azure AI credentials on the server." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    return NextResponse.json({
      extracted,
      file_name: fileName,
      mime_type: fileType,
      file_size_bytes: file.size,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
