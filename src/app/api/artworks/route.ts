import { NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import type { ArtworkSource } from "@/lib/types";
import { titleFromFileName } from "@/lib/config";

export const dynamic = "force-dynamic";

const VALID_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/**
 * Scans /public/artworks and returns every image as an ArtworkSource.
 * Sub-folders become collections. This is what makes new images appear
 * automatically: drop a file into public/artworks and reload.
 */
function scanArtworks(): ArtworkSource[] {
  const root = join(process.cwd(), "public", "artworks");
  if (!existsSync(root)) return [];

  const out: ArtworkSource[] = [];

  const walk = (dir: string, collection: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        walk(full, entry);
      } else if (VALID_EXT.has(extname(entry).toLowerCase())) {
        const col = collection || "main";
        const src = `/artworks/${collection ? `${collection}/` : ""}${entry}`;
        out.push({
          id: `${col}/${entry}`,
          src,
          collection: col,
          fileName: entry,
          title: titleFromFileName(entry),
        });
      }
    }
  };

  // Files directly in the root land in "main"; sub-folders keep their name.
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full, entry);
    } else if (VALID_EXT.has(extname(entry).toLowerCase())) {
      out.push({
        id: `main/${entry}`,
        src: `/artworks/${entry}`,
        collection: "main",
        fileName: entry,
        title: titleFromFileName(entry),
      });
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export async function GET() {
  const artworks = scanArtworks();
  return NextResponse.json({ count: artworks.length, artworks });
}
