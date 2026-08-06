import { copyFile, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "apps", "extension", "dist");
const packageDir = path.join(repoRoot, "artifacts", "extension", "atlas-snapshot-exporter");

const requiredFiles = new Set([
  "background.js",
  "content.js",
  "manifest.json",
  "popup.css",
  "popup.html",
  "popup.js"
]);

const allowedExtensions = new Set([".css", ".html", ".js", ".json"]);
const forbiddenPathParts = new Set([
  "node_modules",
  "src",
  "tests",
  "__tests__",
  "fixtures",
  ".env",
  ".git",
  ".vite"
]);
const forbiddenContent = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b(MONGODB_URI|DATABASE_URL|API_KEY|SECRET|PASSWORD|TOKEN)\b/i
];
const maxPackageBytes = 250 * 1024;

const command = process.argv[2] ?? "validate";

if (command === "validate") {
  await validateDirectory(distDir, "extension build");
  console.log(`Extension build is valid: ${relative(distDir)}`);
} else if (command === "package") {
  await validateDirectory(distDir, "extension build");
  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  for (const file of requiredFiles) {
    await copyFile(path.join(distDir, file), path.join(packageDir, file));
  }

  await validateDirectory(packageDir, "local extension package");
  console.log(`Local extension package is ready: ${relative(packageDir)}`);
} else {
  throw new Error(`Unknown command "${command}". Use "validate" or "package".`);
}

async function validateDirectory(directory, label) {
  if (!existsSync(directory)) {
    throw new Error(`Missing ${label} directory: ${relative(directory)}`);
  }

  const files = await listFiles(directory);
  const relativeFiles = files
    .map((file) => path.relative(directory, file).replaceAll(path.sep, "/"))
    .sort();
  const missingFiles = [...requiredFiles].filter((file) => !relativeFiles.includes(file));
  const extraFiles = relativeFiles.filter((file) => !requiredFiles.has(file));

  if (missingFiles.length > 0) {
    throw new Error(`${label} is missing required files: ${missingFiles.join(", ")}`);
  }

  if (extraFiles.length > 0) {
    throw new Error(`${label} contains unexpected files: ${extraFiles.join(", ")}`);
  }

  let totalBytes = 0;

  for (const file of files) {
    const relativeFile = path.relative(directory, file).replaceAll(path.sep, "/");
    const parts = relativeFile.split("/");
    const extension = path.extname(file);
    const fileStat = await stat(file);

    totalBytes += fileStat.size;

    if (!allowedExtensions.has(extension)) {
      throw new Error(`${label} contains an unsupported file type: ${relativeFile}`);
    }

    if (parts.some((part) => forbiddenPathParts.has(part))) {
      throw new Error(`${label} contains a forbidden path: ${relativeFile}`);
    }

    const content = await readFile(file, "utf8");
    const matchedForbiddenContent = forbiddenContent.find((pattern) => pattern.test(content));

    if (matchedForbiddenContent) {
      throw new Error(`${label} may contain secret-like content in ${relativeFile}`);
    }
  }

  if (totalBytes > maxPackageBytes) {
    throw new Error(`${label} is unexpectedly large: ${totalBytes} bytes`);
  }

  await validateManifest(path.join(directory, "manifest.json"), label);
}

async function validateManifest(manifestPath, label) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (manifest.manifest_version !== 3) {
    throw new Error(`${label} manifest must use Manifest V3.`);
  }

  if (manifest.name !== "ATLAS Snapshot Exporter") {
    throw new Error(`${label} manifest has an unexpected extension name.`);
  }

  if (manifest.background?.service_worker !== "background.js") {
    throw new Error(`${label} manifest must reference background.js.`);
  }

  if (manifest.action?.default_popup !== "popup.html") {
    throw new Error(`${label} manifest must reference popup.html.`);
  }

  const scripts = manifest.content_scripts?.flatMap((entry) => entry.js ?? []) ?? [];

  if (!scripts.includes("content.js")) {
    throw new Error(`${label} manifest must reference content.js.`);
  }

  const permissions = new Set(manifest.permissions ?? []);
  const hostPermissions = new Set(manifest.host_permissions ?? []);

  if (!permissions.has("activeTab") || !permissions.has("downloads")) {
    throw new Error(
      `${label} manifest must only support manual active-tab export and JSON download.`
    );
  }

  if (
    !hostPermissions.has("https://sokker.org/*") ||
    !hostPermissions.has("https://*.sokker.org/*")
  ) {
    throw new Error(`${label} manifest must be scoped to Sokker pages.`);
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    })
  );

  return nested.flat();
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}
