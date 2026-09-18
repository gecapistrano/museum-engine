/**
 * Exhibition, architecture & curation configuration.
 *
 * Single-room gallery: one enclosed lobby with artwork on the walls.
 */

import type {
  ArtworkSource,
  DefaultSpotlight,
  Doorway,
  ExhibitionLayout,
  PlacedArtwork,
  RoomSpec,
  Space,
  Vec3,
  WallSegment,
  WallSpec,
} from "./types";

/** ── Exhibition identity (shown on the opening title wall) ───────────── */
export const EXHIBITION = {
  intro: "A Digital Exhibition",
  title: "The Museum",
  subtitle: "Engine",
  dedication: "A WALKABLE GALLERY, BUILT IN THE BROWSER",
  enterHintDelay: 4200,
} as const;

/** Floating dedication shown in-gallery after the entry walk (Space to continue). */
export const DEDICATION = {
  headline: "Every wall here is authored.",
  body:
    "This is a museum engine rather than an image gallery. The architecture, the hang line, and the pool of moving spotlights are all generated at runtime, so a folder of images becomes a room you can walk through. The works on these walls are public-domain paintings from the Art Institute of Chicago. Swap them for your own and the gallery rebuilds itself around them.",
} as const;

/** Structural constants. */
export const ARCH = {
  wallThickness: 0.34,
  doorWidthDefault: 2.6,
  doorHeight: 2.7,
  proud: 0.07, // how far a print sits off the wall
  eyeLine: 1.5, // hang centre height (slightly below eye level, museum standard)
} as const;

/** Hero frame at the end of the entry sightline — first thing visitors see in the gallery. */
export const ENTRY_HERO = {
  fileName: "georges-seurat-a-sunday-on-la-grande-jatte-1884.jpg",
  /** Fallback when the file sits directly in public/artworks/ (import script uses main/). */
  src: "/artworks/georges-seurat-a-sunday-on-la-grande-jatte-1884.jpg",
  /** North wall interior face + standard print offset (matches other artworks). */
  position: [0, 2.15, -9 + ARCH.wallThickness / 2 + ARCH.proud] as Vec3,
  rotation: [0, 0, 0] as Vec3,
  /** Longest edge of the print in metres. */
  scale: 5.6,
  /** Keep auto-curated prints from overlapping this focal piece. */
  reserveRadius: 5,
} as const;

/** True when a scanned source is the dedicated entry hero image. */
export function isEntryHeroSource(source: ArtworkSource): boolean {
  const name = ENTRY_HERO.fileName.toLowerCase();
  return source.fileName.toLowerCase() === name || source.src.toLowerCase().endsWith(`/${name}`);
}

/** Resolve the hero image URL from scanned sources, or fall back to ENTRY_HERO.src. */
export function resolveEntryHeroSrc(sources: ArtworkSource[]): string {
  const match = sources.find(isEntryHeroSource);
  return match?.src ?? ENTRY_HERO.src;
}

/** ── Player / camera feel ────────────────────────────────────────────── */
export const PLAYER = {
  eyeHeight: 1.68, // realistic human eye level
  radius: 0.4,
  speed: 1.8, // calm museum pace (m/s) — base ×1.2 vs original 1.5
  accel: 5,
  damping: 7,
  lookSpeed: 0.002,
  minZoom: 45, // fov when zoomed in
  maxZoom: 66,
  defaultFov: 65, // calm, natural, cinematic
  /** Very subtle head-bob while walking. */
  bobAmount: 0.018,
  bobSpeed: 7.4,
  swayAmount: 0.004,
} as const;

/** Default per-poster spotlight — sole light source in the gallery. */
export const DEFAULT_SPOTLIGHT: DefaultSpotlight = {
  color: "#ffe0a8",
  intensity: 42,
  angle: 0.5,
  penumbra: 0.88,
  height: 2.6,
  distance: 3.2,
};

const HALF_PI = Math.PI / 2;

/* ─────────────────────────────────────────────────────────────────────
 * FLOOR PLAN — single gallery room
 * Coordinates in metres; visitor starts near the south wall, facing -Z.
 * ──────────────────────────────────────────────────────────────────── */
const SPACES: Space[] = [
  {
    id: "lobby",
    name: "Gallery",
    kind: "lobby",
    x0: -10,
    x1: 10,
    z0: -9,
    z1: 9,
    ceiling: 5.4,
    wallColor: "#2e2a26",
    density: 0.3,
  },
];

/** No doorways — fully enclosed gallery. */
const DOORWAYS: Doorway[] = [];

/** Does a doorway lie on this edge line and overlap its span? */
function doorwayOnEdge(d: Doorway, orient: "x" | "z", pos: number, sMin: number, sMax: number): [number, number] | null {
  if (d.orient !== orient) return null;
  if (Math.abs(d.pos - pos) > 0.02) return null;
  const a = Math.max(d.min, sMin);
  const b = Math.min(d.max, sMax);
  return b - a > 0.05 ? [a, b] : null;
}

/** Split an edge span into solid pieces + opening pieces after removing doorways. */
function carveEdge(
  orient: "x" | "z",
  pos: number,
  sMin: number,
  sMax: number
): { solids: [number, number][]; openings: [number, number][] } {
  const gaps: [number, number][] = [];
  for (const d of DOORWAYS) {
    const g = doorwayOnEdge(d, orient, pos, sMin, sMax);
    if (g) gaps.push(g);
  }
  gaps.sort((a, b) => a[0] - b[0]);
  const solids: [number, number][] = [];
  let cursor = sMin;
  for (const [a, b] of gaps) {
    if (a - cursor > 0.05) solids.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (sMax - cursor > 0.05) solids.push([cursor, sMax]);
  return { solids, openings: gaps };
}

export interface BenchSpot {
  id: string;
  /** World position of the bench centre (floor). */
  x: number;
  z: number;
  /** Bench orientation (radians). */
  yaw: number;
  roomId: string;
}

export interface MuseumBuild {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spaces: Space[];
  /** Wall pieces for rendering + collision (lintels included, collide=false). */
  wallSegments: WallSegment[];
  /** Interior wall faces artworks can hang on (used by editor + auto-curation). */
  mountWalls: WallSpec[];
  rooms: RoomSpec[];
  artworks: PlacedArtwork[];
  benches: BenchSpot[];
  /** Resolved URL for the entry hero image (see ENTRY_HERO.fileName). */
  entryHeroSrc: string;
}

/** Seated eye height (metres) when a visitor sits on a bench. */
export const SEATED_EYE = 1.2;

/** Unit normal of a wall face given its yaw. Plane default normal is +Z. */
export function wallNormal(yaw: number): Vec3 {
  return [Math.sin(yaw), 0, Math.cos(yaw)];
}
/** Horizontal tangent along a wall face given its yaw. */
export function wallTangent(yaw: number): Vec3 {
  return [Math.cos(yaw), 0, -Math.sin(yaw)];
}
/** Convert a local (along-wall X, up Y) offset into a world position. */
export function localToWorld(wall: WallSpec, localX: number, localY: number, proud = ARCH.proud): Vec3 {
  const yaw = wall.rotation[1];
  const n = wallNormal(yaw);
  const t = wallTangent(yaw);
  return [
    wall.position[0] + t[0] * localX + n[0] * proud,
    wall.position[1] + localY,
    wall.position[2] + t[2] * localX + n[2] * proud,
  ];
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const firstToken = base.split(/[_\-\s]/)[0];
  if (/^\d+$/.test(firstToken)) return `Untitled · ${firstToken.slice(0, 4)}`;
  const cleaned = base.replace(/[_\-]+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function makeDefaultSpotlight() {
  return { enabled: true, ...DEFAULT_SPOTLIGHT };
}

/** Generate all wall segments (render + collision) and interior mount faces. */
function generateWalls(spaces: Space[]): { segments: WallSegment[]; mounts: WallSpec[] } {
  const segments: WallSegment[] = [];
  const mounts: WallSpec[] = [];

  for (const s of spaces) {
    const midY = s.ceiling / 2;
    const doorTop = Math.min(ARCH.doorHeight, s.ceiling - 0.15);

    // edge descriptor: [orient, pos, spanMin, spanMax, interiorYaw]
    const edges: { orient: "x" | "z"; pos: number; a: number; b: number; yaw: number }[] = [
      { orient: "x", pos: s.x0, a: s.z0, b: s.z1, yaw: HALF_PI }, // west, normal +X
      { orient: "x", pos: s.x1, a: s.z0, b: s.z1, yaw: -HALF_PI }, // east, normal -X
      { orient: "z", pos: s.z0, a: s.x0, b: s.x1, yaw: 0 }, // north, normal +Z
      { orient: "z", pos: s.z1, a: s.x0, b: s.x1, yaw: Math.PI }, // south, normal -Z
    ];

    for (const e of edges) {
      const { solids, openings } = carveEdge(e.orient, e.pos, e.a, e.b);

      for (const [a, b] of solids) {
        segments.push({ orient: e.orient, pos: e.pos, min: a, max: b, bottom: 0, top: s.ceiling, collide: true });

        // Interior mount face for rooms (skip tiny slivers + connectors).
        const len = b - a;
        if (len >= 3 && s.kind !== "connector" && s.kind !== "entrance") {
          const n = wallNormal(e.yaw);
          const cx = e.orient === "x" ? e.pos : (a + b) / 2;
          const cz = e.orient === "x" ? (a + b) / 2 : e.pos;
          mounts.push({
            id: `${s.id}:${e.orient}:${e.pos.toFixed(1)}:${a.toFixed(1)}`,
            roomId: s.id,
            position: [cx + n[0] * (ARCH.wallThickness / 2), midY, cz + n[2] * (ARCH.wallThickness / 2)],
            rotation: [0, e.yaw, 0],
            size: [len, s.ceiling],
          });
        }
      }

      // Lintels above openings (render-only, no collision).
      for (const [a, b] of openings) {
        if (s.ceiling - doorTop > 0.05) {
          segments.push({ orient: e.orient, pos: e.pos, min: a, max: b, bottom: doorTop, top: s.ceiling, collide: false });
        }
      }
    }

    // Freestanding partition walls: shorter than the ceiling, both faces
    // hangable, solid for collision. They create bays and block sightlines.
    const partH = Math.min(PART_H, s.ceiling - 0.4);
    for (const p of s.partitions ?? []) {
      segments.push({ orient: p.orient, pos: p.pos, min: p.min, max: p.max, bottom: 0, top: partH, collide: true });
      const len = p.max - p.min;
      if (len < 3) continue;
      const cA = (p.min + p.max) / 2;
      // Two opposite faces.
      const faces: { yaw: number }[] =
        p.orient === "z" ? [{ yaw: 0 }, { yaw: Math.PI }] : [{ yaw: HALF_PI }, { yaw: -HALF_PI }];
      faces.forEach((f, fi) => {
        const n = wallNormal(f.yaw);
        const cx = p.orient === "z" ? cA : p.pos;
        const cz = p.orient === "z" ? p.pos : cA;
        mounts.push({
          id: `${s.id}:part:${p.pos.toFixed(1)}:${fi}`,
          roomId: s.id,
          position: [cx + n[0] * (ARCH.wallThickness / 2), partH / 2, cz + n[2] * (ARCH.wallThickness / 2)],
          rotation: [0, f.yaw, 0],
          size: [len, partH],
        });
      });
    }
  }

  return { segments, mounts };
}

/** Freestanding partition wall height (metres). */
const PART_H = 3.5;

/** Size classes for visual hierarchy (longest edge, metres). */
const SIZE = { hero: 3.0, large: 2.5, medium: 1.9, small: 1.4 };

/** Placement rules that guarantee clean corners and no collisions. */
const LAYOUT_RULES = {
  cornerPad: 0.5, // empty wall reserved before every corner / door edge
  minGap: 0.4, // minimum edge-to-edge gap between neighbouring works
};

/** Usable span of a wall after reserving corner/door safe zones. */
function usableWidth(wall: WallSpec): number {
  return wall.size[0] - 2 * LAYOUT_RULES.cornerPad;
}

/**
 * How many works of a given size fit on a wall with corner padding + minimum
 * spacing. Uses `scale` (the longest edge) as each work's reserved width, so
 * even the widest possible framing can never overlap a neighbour.
 */
function fitCount(wall: WallSpec, scale: number): number {
  const u = usableWidth(wall);
  if (u < scale) return 0;
  return Math.max(1, Math.floor((u + LAYOUT_RULES.minGap) / (scale + LAYOUT_RULES.minGap)));
}

/**
 * Place a single, evenly-spaced row of works on a wall. Positions are packed
 * by reserved width + gap and centred as a group, so spacing is uniform,
 * corners stay clear, and no two works can intersect. Consumes the queue.
 */
function placeRow(
  wall: WallSpec,
  scale: number,
  count: number,
  space: Space | undefined,
  queue: ArtworkSource[],
  placed: PlacedArtwork[]
): number {
  const u = usableWidth(wall);
  let n = count;
  while (n > 1 && n * scale + (n - 1) * LAYOUT_RULES.minGap > u) n--;
  if (n <= 0) return 0;
  const total = n * scale + (n - 1) * LAYOUT_RULES.minGap;
  const start = -total / 2 + scale / 2;
  let put = 0;
  for (let k = 0; k < n; k++) {
    const src = queue.shift();
    if (!src) break;
    const localX = start + k * (scale + LAYOUT_RULES.minGap);
    placed.push(makePlaced(src, wall, localX, scale, space));
    put++;
  }
  return put;
}

/**
 * Curate the collection with the discipline of a real exhibition: every wall
 * reserves corner safe zones, works never touch or overlap (reserved-width
 * packing), spacing is uniform, some walls are left intentionally empty for
 * rhythm, single "hero" works command their own wall. Surplus works are placed
 * on any wall that still has spaced capacity.
 */
function curate(
  sources: ArtworkSource[],
  mounts: WallSpec[],
  spaces: Space[],
  opts?: { excludeWallIds?: ReadonlySet<string> }
): PlacedArtwork[] {
  if (sources.length === 0) return placePlaceholderSlots(mounts, spaces);
  const placed: PlacedArtwork[] = [];
  const queue = [...sources];
  const byId = new Map(spaces.map((s) => [s.id, s]));

  // Gallery walls only.
  let bulk = mounts.filter((m) => byId.get(m.roomId)?.kind === "lobby");
  if (opts?.excludeWallIds) bulk = bulk.filter((m) => !opts.excludeWallIds!.has(m.id));
  if (bulk.length === 0) return placed;

  // Per-wall plan: solo (one large/hero work), row (a spaced run), or empty
  // (breathing). The cycle creates rhythm without repeating patterns.
  // Per-wall plan. Fewer intentional empties/solos now — the goal is fuller,
  // balanced walls. One "solo" feature and one intentional empty per cycle.
  const cycle = ["solo", "row", "row", "row", "row", "row", "empty", "row", "row", "row", "row"] as const;
  const plan = bulk.map((_, i) => cycle[i % cycle.length]);
  const wallScale = bulk.map((_, i) => (plan[i] === "solo" ? (i % 3 === 0 ? SIZE.hero : SIZE.large) : SIZE.small));
  const maxN = bulk.map((w, i) => fitCount(w, wallScale[i]));

  // Decide counts up front. Solos = 1, rows grow to fill the collection but
  // never beyond their spaced capacity (maxN keeps the minimum gap, so works
  // can never touch or overlap).
  const count = bulk.map((_, i) => (plan[i] === "empty" ? 0 : plan[i] === "solo" ? Math.min(1, maxN[i]) : 0));
  let budget = queue.length - count.reduce((a, b) => a + b, 0);

  // Balanced fill: round-robin so every row wall reaches a comfortable density
  // together (no wall left sparse while another is packed), then, if works
  // remain, top up evenly to full spaced capacity. This is the "auto rebalance
  // / second curator pass" — density stays even across each room.
  const comfortable = bulk.map((_, i) => (plan[i] === "row" ? Math.max(1, Math.round(maxN[i] * 0.95)) : 0));
  for (let pass = 0; pass < 2 && budget > 0; pass++) {
    const cap = pass === 0 ? comfortable : maxN;
    let progressed = true;
    while (budget > 0 && progressed) {
      progressed = false;
      for (let i = 0; i < bulk.length && budget > 0; i++) {
        if (plan[i] === "row" && count[i] < cap[i]) {
          count[i]++;
          budget--;
          progressed = true;
        }
      }
    }
  }

  bulk.forEach((wall, i) => {
    if (count[i] <= 0 || queue.length === 0) return;
    placeRow(wall, wallScale[i], count[i], byId.get(wall.roomId), queue, placed);
  });

  // Overflow: place every remaining work on walls that still have spaced capacity.
  let spin = 0;
  const maxSpin = bulk.length * sources.length * 2;
  while (queue.length > 0 && spin < maxSpin) {
    const i = spin % bulk.length;
    if (plan[i] === "empty") {
      spin++;
      continue;
    }
    const wall = bulk[i];
    const scale = plan[i] === "solo" ? wallScale[i] : SIZE.small;
    const cap = fitCount(wall, scale);
    const onWall = placed.filter((p) => p.wallId === wall.id).length;
    if (onWall >= cap) {
      spin++;
      continue;
    }
    const put = placeRow(wall, scale, 1, byId.get(wall.roomId), queue, placed);
    if (put === 0) {
      spin++;
      continue;
    }
    spin++;
  }

  return placed;
}

/** Gray empty frames when no images have been added yet. */
function placePlaceholderSlots(mounts: WallSpec[], spaces: Space[]): PlacedArtwork[] {
  const byId = new Map(spaces.map((s) => [s.id, s]));
  const walls = mounts
    .filter((m) => byId.get(m.roomId)?.kind === "lobby")
    .filter((m) => m.size[0] >= 3.5);

  const placed: PlacedArtwork[] = [];
  let idx = 0;
  for (const wall of walls) {
    const scale = SIZE.medium;
    const n = Math.min(2, fitCount(wall, scale));
    if (n <= 0) continue;
    const total = n * scale + (n - 1) * LAYOUT_RULES.minGap;
    const start = -total / 2 + scale / 2;
    for (let k = 0; k < n; k++) {
      const localX = start + k * (scale + LAYOUT_RULES.minGap);
      placed.push(makePlaceholder(wall, localX, scale, idx++, byId.get(wall.roomId)));
    }
  }
  return placed;
}

function makePlaceholder(
  wall: WallSpec,
  localX: number,
  scale: number,
  index: number,
  space?: Space
): PlacedArtwork {
  const localY = ARCH.eyeLine - wall.position[1];
  const pos = localToWorld(wall, localX, localY);
  return {
    id: `placeholder-${index}`,
    sourceId: `placeholder/slot-${index}`,
    src: "",
    title: "",
    artist: "",
    year: "",
    medium: "",
    description: "",
    position: pos,
    rotation: [0, wall.rotation[1], 0],
    scale,
    roomId: space?.id ?? wall.roomId,
    wallId: wall.id,
    spotlight: makeDefaultSpotlight(),
    placeholder: true,
  };
}

function makePlaced(src: ArtworkSource, wall: WallSpec, localX: number, scale: number, space?: Space): PlacedArtwork {
  // Consistent museum hang line: every work is centred on the same eye-line.
  // (Tall pieces are nudged up at render time only if they'd meet the floor.)
  const localY = ARCH.eyeLine - wall.position[1];
  const pos = localToWorld(wall, localX, localY);
  return {
    id: `art-${src.id.replace(/[^a-zA-Z0-9]/g, "_")}`,
    sourceId: src.id,
    src: src.src,
    title: src.title,
    artist: "",
    year: "",
    medium: "Archival pigment print",
    description: "",
    position: pos,
    rotation: [0, wall.rotation[1], 0],
    scale,
    roomId: space?.id ?? wall.roomId,
    wallId: wall.id,
    spotlight: makeDefaultSpotlight(),
  };
}

/** True when a floor point overlaps the entry hero frame zone. */
function isInHeroZoneAt(x: number, z: number): boolean {
  const [hx, , hz] = ENTRY_HERO.position;
  const r = ENTRY_HERO.reserveRadius;
  const dx = x - hx;
  const dz = z - hz;
  return dx * dx + dz * dz <= r * r;
}

function isInHeroZone(art: PlacedArtwork): boolean {
  return isInHeroZoneAt(art.position[0], art.position[2]);
}

const BENCH_OFFSET_FROM_WALL = 2.35;
const BENCH_CORNER_PAD = 0.8;
const BENCH_MIN_SPAN = 1.5;

function benchCentersAlongSpan(start: number, end: number, splitHero: boolean): number[] {
  const a = start + BENCH_CORNER_PAD;
  const b = end - BENCH_CORNER_PAD;
  if (b - a < BENCH_MIN_SPAN) return [];

  if (!splitHero) return [(a + b) / 2];

  const [hx] = ENTRY_HERO.position;
  const r = ENTRY_HERO.reserveRadius;
  const spots: number[] = [];
  const leftEnd = Math.min(b, hx - r);
  if (leftEnd - a >= BENCH_MIN_SPAN) spots.push((a + leftEnd) / 2);
  const rightStart = Math.max(a, hx + r);
  if (b - rightStart >= BENCH_MIN_SPAN) spots.push((rightStart + b) / 2);
  return spots;
}

/** One bench per wall; north wall benches flank the entry hero zone. */
function generateBenches(spaces: Space[]): BenchSpot[] {
  const benches: BenchSpot[] = [];
  let idx = 0;
  const inward = ARCH.wallThickness / 2 + BENCH_OFFSET_FROM_WALL;

  for (const s of spaces) {
    if (s.kind !== "lobby") continue;

    const addBench = (x: number, z: number, yaw: number) => {
      if (isInHeroZoneAt(x, z)) return;
      benches.push({ id: `${s.id}-bench-${idx}`, x, z, yaw, roomId: s.id });
      idx += 1;
    };

    for (const z of benchCentersAlongSpan(s.z0, s.z1, false)) addBench(s.x0 + inward, z, HALF_PI);
    for (const z of benchCentersAlongSpan(s.z0, s.z1, false)) addBench(s.x1 - inward, z, -HALF_PI);
    for (const x of benchCentersAlongSpan(s.x0, s.x1, true)) addBench(x, s.z0 + inward, Math.PI);
    for (const x of benchCentersAlongSpan(s.x0, s.x1, false)) addBench(x, s.z1 - inward, 0);
  }

  return benches;
}

/** North-wall mount ids — kept clear for the entry hero image. */
function northWallIds(mounts: WallSpec[]): Set<string> {
  return new Set(mounts.filter((m) => m.rotation[1] === 0).map((m) => m.id));
}

/** Drop hero-zone placements and re-hang those works on other walls. */
function applyHeroReserve(
  artworks: PlacedArtwork[],
  sources: ArtworkSource[],
  mounts: WallSpec[],
  spaces: Space[]
): PlacedArtwork[] {
  const kept = artworks.filter((a) => !isInHeroZone(a));
  const removedIds = new Set(artworks.filter((a) => isInHeroZone(a)).map((a) => a.sourceId));
  if (removedIds.size === 0) return kept;

  const removedSources = sources.filter((s) => removedIds.has(s.id));
  const northIds = northWallIds(mounts);
  const relocated = curate(removedSources, mounts, spaces, { excludeWallIds: northIds });
  return [...kept, ...relocated.filter((a) => !isInHeroZone(a))];
}

/** Build the whole museum from the imported sources. */
export function buildMuseum(sources: ArtworkSource[]): MuseumBuild {
  const entryHeroSrc = resolveEntryHeroSrc(sources);
  const curatedSources = sources.filter((s) => !isEntryHeroSource(s));
  const spaces = SPACES;
  const { segments, mounts } = generateWalls(spaces);
  const artworks = applyHeroReserve(curate(curatedSources, mounts, spaces), curatedSources, mounts, spaces);

  const rooms: RoomSpec[] = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    center: [(s.x0 + s.x1) / 2, 0, (s.z0 + s.z1) / 2],
    size: [s.x1 - s.x0, s.z1 - s.z0],
  }));

  const minX = Math.min(...spaces.map((s) => s.x0));
  const maxX = Math.max(...spaces.map((s) => s.x1));
  const minZ = Math.min(...spaces.map((s) => s.z0));
  const maxZ = Math.max(...spaces.map((s) => s.z1));

  const benches = generateBenches(spaces);

  return { bounds: { minX, maxX, minZ, maxZ }, spaces, wallSegments: segments, mountWalls: mounts, rooms, artworks, benches, entryHeroSrc };
}

/**
 * Combine a saved layout with auto-placement for any new images that were
 * added after the layout was authored. Keeps hand-placed works; fills in the rest.
 */
export function mergeLayoutArtworks(
  layoutArtworks: PlacedArtwork[],
  sources: ArtworkSource[],
  build: MuseumBuild
): PlacedArtwork[] {
  const { artworks: autoArtworks, mountWalls, spaces } = build;
  const bySourceId = new Map(sources.map((s) => [s.id, s]));
  const autoBySourceId = new Map(autoArtworks.map((a) => [a.sourceId, a]));

  const fromLayout = layoutArtworks
    .filter((a) => bySourceId.has(a.sourceId))
    .filter((a) => !isEntryHeroSource(bySourceId.get(a.sourceId)!))
    .map((a) => ({ ...a, src: bySourceId.get(a.sourceId)!.src }));

  if (fromLayout.length === 0) return autoArtworks;

  const layoutSourceIds = new Set(fromLayout.map((a) => a.sourceId));
  const extras = sources
    .filter((s) => !isEntryHeroSource(s) && !layoutSourceIds.has(s.id))
    .map((s) => autoBySourceId.get(s.id))
    .filter((a): a is PlacedArtwork => a != null);

  let merged = [...fromLayout, ...extras];
  const placedIds = new Set(merged.map((a) => a.sourceId));
  const stillMissing = sources.filter((s) => !isEntryHeroSource(s) && !placedIds.has(s.id));

  if (stillMissing.length > 0) {
    const northIds = northWallIds(mountWalls);
    const added = curate(stillMissing, mountWalls, spaces, { excludeWallIds: northIds });
    merged = [...merged, ...added.filter((a) => !isInHeroZone(a))];
  }

  return merged;
}

/** Which space contains a floor-plan point (with a small margin). */
export function getSpaceIdForPoint(x: number, z: number, spaces: Space[]): string | null {
  for (const s of spaces) {
    if (x >= s.x0 - 0.2 && x <= s.x1 + 0.2 && z >= s.z0 - 0.2 && z <= s.z1 + 0.2) return s.id;
  }
  return null;
}

/** Wrap a placement array into a persisted layout envelope. */
export function toLayout(artworks: PlacedArtwork[]): ExhibitionLayout {
  return { version: 1, updatedAt: new Date().toISOString(), artworks };
}

/** Spawn position for the entry walk (inside the sealed gallery). */
export const ENTRANCE = {
  startZ: 7.5,
  /** Target the visitor walks to when entering — centre of the gallery. */
  walkToZ: 0,
} as const;
