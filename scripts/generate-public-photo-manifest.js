import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(root, "public");
const manifestPath = path.join(publicDirectory, "public-photo-manifest.json");

const files = (await readdir(publicDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^WhatsApp Image .+\.jpe?g$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

const photos = files.map((name, index) => ({
  id: index + 1,
  name,
  url: `/${encodeURIComponent(name)}`,
}));

await writeFile(manifestPath, `${JSON.stringify(photos, null, 2)}\n`);
console.log(`Generated ${photos.length} public product photo entries.`);
