import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

export async function convertPdfToHtml(buffer: Buffer): Promise<string> {
  const parsed = await pdfParse(buffer);
  const pages = parsed.text.split(/\f/);

  const pageHtml = pages
    .filter((page) => page.trim().length > 0)
    .map((page, index) => {
      const paragraphs = page
        .split(/\n{2,}/)
        .filter((paragraph) => paragraph.trim().length > 0)
        .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
        .join("\n");

      return `<div class="pdf-page" data-page="${index + 1}">${paragraphs}</div>`;
    })
    .join("\n<hr />\n");

  return pageHtml;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br />");
}
