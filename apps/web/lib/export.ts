import type { MediaResult } from "@/hooks/useUpload";

export function downloadTextFile({
  contents,
  fileName,
}: {
  contents: string;
  fileName: string;
}) {
  if (!contents) return;

  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getExtractedText(item?: MediaResult | null) {
  return item?.extractedText || item?.textPreview || "";
}

export function getTextExportFileName(item?: MediaResult | null) {
  const baseName = item?.originalFileName || item?.fileId || "mandvision-document";
  const withoutExtension = baseName.replace(/\.[^/.]+$/, "");

  return `${sanitizeFileName(withoutExtension)}-extracted-text.txt`;
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "mandvision-document";
}
