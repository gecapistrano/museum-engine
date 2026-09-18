/**
 * Download the demo exhibition from the Art Institute of Chicago's open API.
 *
 *   node scripts/fetch-artworks.mjs
 *
 * Every piece is checked against the API's `is_public_domain` flag before it is
 * written to disk, so the bundled exhibition contains only works that are free
 * of copyright. Attribution for each downloaded file is written to
 * public/artworks/CREDITS.md.
 *
 * Images come from the IIIF endpoint documented at
 * https://api.artic.edu/docs/#iiif-image-api
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const API = "https://api.artic.edu/api/v1/artworks";
const IIIF = "https://www.artic.edu/iiif/2";

/** The Art Institute asks API consumers to identify themselves on every call. */
const HEADERS = {
  "User-Agent": "museum-engine/1.0",
  "AIC-User-Agent": "museum-engine (https://github.com/gecapistrano)",
};
const FIELDS =
  "id,title,artist_title,artist_display,date_display,medium_display,image_id,is_public_domain,credit_line";

const OUT_DIR = join(process.cwd(), "public", "artworks", "main");

/**
 * Search terms chosen for recognisable, wall-friendly works.
 *
 * `expect` is the artist the query is aiming at. A search only counts as a hit
 * when the public-domain result actually comes from that artist, because the
 * API happily returns an unrelated public-domain work when the requested piece
 * is still in copyright, which would otherwise be saved under a wrong name.
 */
const WANTED = [
  { q: "The Bedroom Van Gogh", expect: "Vincent van Gogh" },
  { q: "A Sunday on La Grande Jatte Seurat", expect: "Georges Seurat" },
  { q: "Paris Street Rainy Day Caillebotte", expect: "Gustave Caillebotte" },
  { q: "Water Lilies Monet", expect: "Claude Monet" },
  { q: "The Child's Bath Mary Cassatt", expect: "Mary Cassatt" },
  { q: "Two Sisters On the Terrace Renoir", expect: "Pierre-Auguste Renoir" },
  { q: "At the Moulin Rouge Toulouse-Lautrec", expect: "Henri de Toulouse-Lautrec" },
  { q: "Under the Wave off Kanagawa Hokusai", expect: "Katsushika Hokusai" },
];

/** Build a stable, filesystem-safe name from what the API actually returned. */
function slugify(artist, title) {
  const trimmed = title.split(",")[0].split("(")[0];
  return `${artist} ${trimmed}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

async function searchOne({ q, expect }) {
  const url = `${API}/search?q=${encodeURIComponent(q)}&fields=${FIELDS}&limit=12`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`search failed for "${q}": ${res.status}`);
  const { data } = await res.json();

  const hit = data.find(
    (a) => a.is_public_domain && a.image_id && a.artist_title === expect
  );
  if (!hit) {
    console.warn(`  skip: no public-domain work by ${expect} for "${q}"`);
    return null;
  }
  return { ...hit, slug: slugify(hit.artist_title, hit.title) };
}

async function download(art) {
  const url = `${IIIF}/${art.image_id}/full/1200,/0/default.jpg`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`image failed for ${art.title}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `${art.slug}.jpg`;
  await writeFile(join(OUT_DIR, file), buf);
  console.log(`  saved ${file} (${(buf.length / 1024).toFixed(0)} KB) - ${art.title}`);
  return file;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const rows = [];
  for (const want of WANTED) {
    const art = await searchOne(want);
    if (!art) continue;
    const file = await download(art);
    rows.push({ file, art });
  }

  const credits = [
    "# Exhibition credits",
    "",
    "Every work bundled with this repository is in the **public domain** and was",
    "downloaded from the [Art Institute of Chicago open API](https://api.artic.edu/docs/)",
    "by `scripts/fetch-artworks.mjs`, which refuses to save anything the API does",
    "not flag with `is_public_domain: true`.",
    "",
    "| File | Work | Artist | Date | Medium |",
    "| :--- | :--- | :--- | :--- | :--- |",
    ...rows.map(
      ({ file, art }) =>
        `| \`${file}\` | [${art.title}](https://www.artic.edu/artworks/${art.id}) | ${
          art.artist_title ?? "Unknown"
        } | ${art.date_display ?? "-"} | ${art.medium_display ?? "-"} |`
    ),
    "",
    "Replace these with your own images at any time - drop files into",
    "`public/artworks/` and the gallery picks them up automatically.",
    "",
  ].join("\n");

  await writeFile(join(process.cwd(), "public", "artworks", "CREDITS.md"), credits);
  console.log(`\nwrote public/artworks/CREDITS.md with ${rows.length} works`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
