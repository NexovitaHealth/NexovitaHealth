type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT_MARGIN = 48;
const TOP_MARGIN = 56;
const LINE_HEIGHT = 16;
const MAX_CHARS = 92;
const LINES_PER_PAGE = 42;

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "-");
}

function truncate(value: string, max = MAX_CHARS) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function serializeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function buildLineCommands(lines: PdfLine[]) {
  return lines
    .map((line, index) => {
      const y = PAGE_HEIGHT - TOP_MARGIN - index * LINE_HEIGHT;
      const font = line.bold ? "F2" : "F1";
      return `BT /${font} ${line.size ?? 10} Tf ${LEFT_MARGIN} ${y} Td (${escapePdfText(truncate(line.text))}) Tj ET`;
    })
    .join("\n");
}

function chunkLines(lines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  for (let index = 0; index < lines.length; index += LINES_PER_PAGE) {
    pages.push(lines.slice(index, index + LINES_PER_PAGE));
  }
  return pages.length ? pages : [[{ text: "No report data available." }]];
}

export function createReportPdf(params: {
  title: string;
  subtitle: string;
  summary: Record<string, unknown>;
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
}) {
  const lines: PdfLine[] = [
    { text: params.title, size: 18, bold: true },
    { text: params.subtitle, size: 11 },
    { text: `Generated: ${new Date().toISOString()}`, size: 9 },
    { text: "" },
    { text: "Summary", size: 13, bold: true },
    ...Object.entries(params.summary).map(([key, value]) => ({
      text: `${key}: ${serializeValue(value)}`,
      size: 10,
    })),
    { text: "" },
    { text: "Rows", size: 13, bold: true },
  ];

  if (params.rows.length === 0) {
    lines.push({ text: "No rows found for the selected period." });
  } else {
    params.rows.forEach((row, rowIndex) => {
      const rendered = params.columns
        .map((column) => `${column}: ${serializeValue(row[column])}`)
        .join(" | ");
      lines.push({
        text: `${rowIndex + 1}. ${rendered}`,
        size: 8,
      });
    });
  }

  const pageLines = chunkLines(lines);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageLines
      .map((_page, index) => `${3 + index * 2} 0 R`)
      .join(" ")}] /Count ${pageLines.length} >>`,
  ];

  pageLines.forEach((page, index) => {
    const pageObjectNumber = 3 + index * 2;
    const streamObjectNumber = pageObjectNumber + 1;
    const stream = buildLineCommands([
      ...page,
      {
        text: `Page ${index + 1} of ${pageLines.length}`,
        size: 8,
      },
    ]);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${streamObjectNumber} 0 R >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  });

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "ascii"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(chunks.join(""), "ascii");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return Buffer.from(chunks.join(""), "ascii");
}
