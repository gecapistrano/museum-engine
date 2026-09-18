#!/usr/bin/env node
/**
 * An Appreciation of a Masterpiece — Artwork import script
 * ------------------------------------------------------------------
 * Copies every image from the configured source folder into
 * `public/artworks/<collection>/` so the app can serve them statically.
 *
 * - Source folder is read from ARTWORK_SOURCE_DIR (see .env.example).
 * - Images placed directly in the source root land in the "main" collection.
 * - Sub-folders of the source become named collections (walls) automatically.
 * - Re-running is idempotent: only new / changed files are copied.
 *
 * This is intentionally dependency-free (pure Node) so it can run in a
 * `predev` hook without an install step. Actual image dimensions are
 * detected at runtime by three.js when the texture loads, so no image
 * decoding library is required here.
 * ------------------------------------------------------------------
 */

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

const SILENT = process.argv.includes("--silent");
const log = (...args) => !SILENT && console.log(...args);

const VALID_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Load ARTWORK_SOURCE_DIR from environment, .env, or fall back to the default.
function readEnvSourceDir() {
  if (process.env.ARTWORK_SOURCE_DIR) return process.env.ARTWORK_SOURCE_DIR;
  const envPath = join(ROOT, ".env");
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf8");
      const match = content.match(/^ARTWORK_SOURCE_DIR\s*=\s*"?([^"\n\r]+)"?/m);
      if (match) return match[1].trim();
    } catch {
      /* ignore */
    }
  }
  return join(ROOT, "public", "artworks-empty");
}

const DEST_ROOT = join(ROOT, "public", "artworks");

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function collectImages(dir, collection, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      collectImages(full, entry, out);
    } else if (VALID_EXT.has(extname(entry).toLowerCase())) {
      out.push({ full, collection, name: entry, size: s.size, mtime: s.mtimeMs });
    }
  }
}

async function main() {
  const SOURCE_DIR = readEnvSourceDir();

  if (!existsSync(SOURCE_DIR)) {
    log(`[import:artworks] Source folder not found: ${SOURCE_DIR}`);
    log("[import:artworks] Nothing to import. The app will still serve any files already in public/artworks.");
    ensureDir(DEST_ROOT);
    return;
  }

  const images = [];
  collectImages(SOURCE_DIR, "main", images);

  if (images.length === 0) {
    log(`[import:artworks] No images found in ${SOURCE_DIR}`);
    ensureDir(DEST_ROOT);
    return;
  }

  ensureDir(DEST_ROOT);
  let copied = 0;
  let skipped = 0;

  for (const img of images) {
    const destDir = join(DEST_ROOT, img.collection);
    ensureDir(destDir);
    const destPath = join(destDir, img.name);

    let needsCopy = true;
    if (existsSync(destPath)) {
      const ds = statSync(destPath);
      if (ds.size === img.size) needsCopy = false;
    }

    if (needsCopy) {
      copyFileSync(img.full, destPath);
      copied++;
    } else {
      skipped++;
    }
  }

  log(`[import:artworks] Source: ${SOURCE_DIR}`);
  log(`[import:artworks] Collections: ${[...new Set(images.map((i) => i.collection))].join(", ")}`);
  log(`[import:artworks] Copied ${copied} new image(s), ${skipped} already up to date. Total: ${images.length}.`);
}

main().catch((err) => {
  console.error("[import:artworks] Failed:", err);
  process.exitCode = 1;
});
