// `import x from "./file.md" with { type: "text" }` (Bun): the file's text, carried in the bundle.
declare module "*.md" {
  const text: string;
  export default text;
}
declare module "*.swift" {
  const text: string;
  export default text;
}

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
