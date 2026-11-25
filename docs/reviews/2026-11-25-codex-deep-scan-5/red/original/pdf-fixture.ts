/** Minimal valid, text-layer PDF written for this scout. No tools, fonts, network or UI. */
export function pdfFixture(lines: {text: string; x: number; y: number}[]): Uint8Array {
  const esc = (s: string) => s.replace(/[()\\]/g, '\\$&');
  const content = lines.map(l => `BT /F1 8 Tf ${l.x} ${l.y} Td (${esc(l.text)}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let raw = '%PDF-1.4\n'; const offsets = [0];
  for (const [i, obj] of objs.entries()) { offsets.push(raw.length); raw += `${i + 1} 0 obj\n${obj}\nendobj\n`; }
  const start = raw.length;
  raw += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  raw += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(raw);
}
