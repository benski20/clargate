import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import {
  COMPLIANCE_CERTIFICATION_MAX_BYTES,
  COMPLIANCE_CERTIFICATION_TYPES,
} from "@/lib/compliance-certifications";
import { requirePiAppUser } from "@/lib/require-pi-user-server";
import { generateComplianceCertificationS3Key, putObjectToS3 } from "@/lib/s3-server";
import type { ComplianceCertificationType } from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const VALID_TYPES = new Set<string>(COMPLIANCE_CERTIFICATION_TYPES.map((t) => t.value));

function parseDateField(raw: FormDataEntryValue | null, field: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Invalid ${field}`);
  }
  if (!Number.isFinite(Date.parse(`${trimmed}T12:00:00`))) {
    throw new Error(`Invalid ${field}`);
  }
  return trimmed;
}

/**
 * Step 2: persist certificate to S3 and Supabase after user confirms extracted metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePiAppUser();
    if (!auth.ok) return auth.response;
    const { appUser } = auth;

    let svc: ReturnType<typeof createServiceClient>;
    try {
      svc = createServiceClient();
    } catch {
      return NextResponse.json(
        { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const certificationTypeRaw = formData.get("certification_type");
    const titleRaw = formData.get("title");
    const traineeNameRaw = formData.get("trainee_name");
    const extractedMetadataRaw = formData.get("extracted_metadata");

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }
    if (file.size > COMPLIANCE_CERTIFICATION_MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 16 MB)" }, { status: 400 });
    }

    const certificationType =
      typeof certificationTypeRaw === "string" ? certificationTypeRaw.trim() : "";
    if (!VALID_TYPES.has(certificationType)) {
      return NextResponse.json({ error: "Invalid certification_type" }, { status: 400 });
    }

    const fileName = file instanceof File && file.name ? file.name : "certificate.pdf";
    const fileType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(fileType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF or image (PNG, JPEG, WebP)." },
        { status: 400 },
      );
    }

    let expiresAt: string | null;
    let issuedAt: string | null;
    try {
      expiresAt = parseDateField(formData.get("expires_at"), "expires_at");
      issuedAt = parseDateField(formData.get("issued_at"), "issued_at");
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid date" },
        { status: 400 },
      );
    }

    const title =
      typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim().slice(0, 200) : null;
    const traineeName =
      typeof traineeNameRaw === "string" && traineeNameRaw.trim()
        ? traineeNameRaw.trim().slice(0, 200)
        : null;

    let extractedMetadata: Record<string, unknown> | null = null;
    if (typeof extractedMetadataRaw === "string" && extractedMetadataRaw.trim()) {
      try {
        extractedMetadata = JSON.parse(extractedMetadataRaw) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: "Invalid extracted_metadata JSON" }, { status: 400 });
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    const s3Key = generateComplianceCertificationS3Key(
      appUser.institution_id,
      appUser.id,
      fileName,
    );

    try {
      await putObjectToS3({ key: s3Key, body, contentType: fileType });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Missing ")) {
        return NextResponse.json(
          { error: "S3 not configured (set AWS_* and S3_BUCKET_NAME on the server)" },
          { status: 503 },
        );
      }
      throw e;
    }

    const { data: row, error: insertErr } = await svc
      .from("compliance_certifications")
      .insert({
        user_id: appUser.id,
        institution_id: appUser.institution_id,
        certification_type: certificationType as ComplianceCertificationType,
        title,
        trainee_name: traineeName,
        issued_at: issuedAt,
        file_name: fileName,
        s3_key: s3Key,
        mime_type: fileType,
        file_size_bytes: file.size,
        expires_at: expiresAt,
        extracted_metadata: extractedMetadata,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await svc.from("audit_log").insert({
      institution_id: appUser.institution_id,
      user_id: appUser.id,
      action: "certification_uploaded",
      entity_type: "compliance_certification",
      entity_id: row.id,
      metadata: {
        file_name: fileName,
        certification_type: certificationType,
        ai_extracted: Boolean(extractedMetadata),
      },
    });

    return NextResponse.json({ certification: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
