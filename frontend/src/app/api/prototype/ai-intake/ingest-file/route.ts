import { NextResponse } from "next/server";
import mammoth from "mammoth";
import pdf from "pdf-parse";

export const runtime = "nodejs";

/** Per-file cap for PDF/text extraction (browser + server memory). Product “50 GB” needs multipart/S3 — not this path. */
const MAX_BYTES = 100 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      mimeType?: string;
      base64?: string;
    };
    const name = String(body.name ?? "file");
    const mimeType = String(body.mimeType ?? "");
    const base64 = String(body.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
    if (!base64) {
      return NextResponse.json({ error: "base64 required" }, { status: 400 });
    }

    const buf = Buffer.from(base64, "base64");
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: "file too large (max 100 MB per file for analysis)" }, { status: 400 });
    }

    const lower = name.toLowerCase();
    const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
    if (isPdf) {
      const data = await pdf(buf);
      return NextResponse.json({ text: (data.text || "").trim() });
    }

    const isDocx =
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lower.endsWith(".docx");
    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: buf });
      return NextResponse.json({ text: (result.value || "").trim() });
    }

    const isExcel =
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel" ||
      /\.(xlsx|xls)$/i.test(lower);

    if (isExcel) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buf, { type: "buffer" });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) sheets.push(`## Sheet: ${sheetName}\n${csv}`);
      }
      const text = sheets.join("\n\n").trim();
      if (!text) {
        return NextResponse.json({ error: "No readable data found in spreadsheet." }, { status: 400 });
      }
      return NextResponse.json({ text });
    }

    const isText =
      mimeType.startsWith("text/") ||
      ["application/json", "application/xml"].includes(mimeType) ||
      /\.(txt|md|csv|json|xml|html?)$/i.test(lower);

    if (isText) {
      return NextResponse.json({ text: buf.toString("utf8") });
    }

    return NextResponse.json(
      {
        error:
          "Unsupported type. Use PDF, Word (.docx), Excel (.xlsx, .xls), or plain text (.txt, .md, .csv, .json, .html).",
      },
      { status: 400 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to extract text from file" }, { status: 500 });
  }
}
