"use client";

import { useEffect, useState } from "react";
import { buildMuseum, mergeLayoutArtworks, type MuseumBuild } from "@/lib/config";
import { useMuseum } from "@/lib/store";
import type { ArtworkSource, ExhibitionLayout } from "@/lib/types";

interface MuseumData {
  build: MuseumBuild | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the auto-detected artwork sources and any authored layout, then
 * hydrates the museum store. The architectural shell (walls/rooms/bounds)
 * is always derived from the source set so it fits the collection; the
 * placed artworks come from a saved layout when present, otherwise from
 * the default auto-layout.
 */
export function useMuseumData(): MuseumData {
  const [build, setBuild] = useState<MuseumBuild | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSources = useMuseum((s) => s.setSources);
  const setArtworks = useMuseum((s) => s.setArtworks);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [srcRes, layoutRes] = await Promise.all([
          fetch("/api/artworks", { cache: "no-store" }),
          fetch("/api/layout", { cache: "no-store" }),
        ]);

        const srcJson = (await srcRes.json()) as { artworks: ArtworkSource[] };
        const layoutJson = (await layoutRes.json()) as { layout: ExhibitionLayout | null };

        if (cancelled) return;

        const sources = srcJson.artworks ?? [];
        const built = buildMuseum(sources);

        setSources(sources);

        // Merge a saved layout with current sources (keeps only works whose
        // image still exists, and refreshes the src path from the source).
        if (layoutJson.layout && layoutJson.layout.artworks.length > 0) {
          setArtworks(mergeLayoutArtworks(layoutJson.layout.artworks, sources, built));
        } else {
          setArtworks(built.artworks);
        }

        setBuild(built);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load museum data");
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [setSources, setArtworks]);

  return { build, loading, error };
}
