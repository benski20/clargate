import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { requireAdminSession } from "@/lib/require-admin-server";
import {
  generateInstitutionGuidanceS3Key,
  putObjectToS3,
} from "@/lib/s3-server";
import type { InstitutionAiGuidanceCategory } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024;

const CATEGORIES: InstitutionAiGuidanceCategory[] = [
  "example_proposal",
  "rules",
  "guidelines",
  "institutional",
];

function isCategory(s: string): s is InstitutionAiGuidanceCategory {
  return CATEGORIES.includes(s as InstitutionAiGuidanceCategory);
}

async function extractText(buf: Buffer, name: string, mime: string): Promise<string> {
  const lower = name.toLowerCase();
  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
  if (isPdf) {
    const data = await pdf(buf);
    return (data.text || "").trim();
  }
  const isText =
    mime.startsWith("text/") ||
    ["application/json", "application/xml"].includes(mime) ||
    /\.(txt|md|csv|json|xml|html?)$/i.test(lower);
  if (isText) {
    return buf.toString("utf8").trim();
  }
  throw new Error("Unsupported file type. Use PDF or plain text (.txt, .md).");
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const category = String(formData.get("category") ?? "");
  if (!isCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const titleRaw = formData.get("title");
  const title = typeof titleRaw === "string" ? titleRaw.trim() || null : null;

  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
  }

  const fileName = file instanceof File && file.name ? file.name : "upload.bin";
  const mimeType = file instanceof File && file.type ? file.type : "application/octet-stream";

  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  let extracted: string;
  try {
    extracted = await extractText(body, fileName, mimeType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not read file";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const institutionId = auth.session.appUser.institution_id;
  const s3Key = generateInstitutionGuidanceS3Key(institutionId, id, fileName);

  try {
    await putObjectToS3({
      key: s3Key,
      body,
      contentType: mimeType || "application/octet-stream",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Missing ")) {
      return NextResponse.json(
        { error: "S3 not configured (set AWS_* and S3_BUCKET_NAME on the server)" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data, error } = await auth.session.supabase
    .from("institution_ai_guidance")
    .insert({
      id,
      institution_id: institutionId,
      category,
      title,
      content_type: "file",
      file_name: fileName,
      s3_key: s3Key,
      mime_type: mimeType,
      extracted_text: extracted,
      created_by: auth.session.appUser.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
