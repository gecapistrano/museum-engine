"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMuseum } from "@/lib/store";

/**
 * Inspect mode UI. The camera (handled by the controller) glides toward the
 * artwork; here we surface its exhibition label and a way back. The gallery
 * stays visible behind the panel, as requested.
 */
export function InspectOverlay() {
  const inspectId = useMuseum((s) => s.inspectId);
  const artworks = useMuseum((s) => s.artworks);
  const inspect = useMuseum((s) => s.inspect);

  const art = artworks.find((a) => a.id === inspectId) ?? null;

  return (
    <AnimatePresence>
      {art && (
        <motion.div
          key="inspect"
          className="pointer-events-none absolute inset-0 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Gentle darkening at the edges to focus the eye. */}
          <div className="vignette absolute inset-0" />

          {/* Exhibition label, lower-left, museum wall-text style. */}
          <motion.div
            className="pointer-events-auto absolute bottom-10 left-10 max-w-sm border-l border-bone/20 pl-5"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ delay: 0.4, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-display text-2xl font-light tracking-wide text-bone">
              {art.placeholder ? "Photo placeholder" : art.title}
            </h2>
            {!art.placeholder && art.artist && (
              <p className="mt-1 text-sm tracking-wide text-bone/70">{art.artist}</p>
            )}
            {!art.placeholder && (
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-bone/45">
                {[art.year, art.medium].filter(Boolean).join(" · ")}
              </p>
            )}
            {!art.placeholder && art.description && (
              <p className="mt-4 text-sm leading-relaxed text-bone/70">{art.description}</p>
            )}
          </motion.div>

          {/* Return control. */}
          <motion.button
            className="pointer-events-auto absolute right-10 top-10 rounded-full border border-bone/25 px-5 py-2 text-xs uppercase tracking-museum text-bone/80 backdrop-blur-sm transition hover:border-bone/60 hover:text-bone"
            onClick={() => inspect(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.5 }}
          >
            E / Esc · Return
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
