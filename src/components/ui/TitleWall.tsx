"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EXHIBITION } from "@/lib/config";
import { useMuseum } from "@/lib/store";
import { museumAudio } from "@/lib/audio";
import { IntroAtmosphere } from "./IntroAtmosphere";

/**
 * The opening experience. Fades from black into a deep exhibition wall with
 * bokeh and sparks, the title typography rises gently, and only after a few
 * seconds does a quiet "Click anywhere to enter" appear.
 */
export function TitleWall() {
  const phase = useMuseum((s) => s.phase);
  const setPhase = useMuseum((s) => s.setPhase);
  const loaded = useMuseum((s) => s.loaded);
  const reduced = useMuseum((s) => s.settings.reducedMotion);

  const [showHint, setShowHint] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (phase !== "title") return;
    const t = setTimeout(() => setShowHint(true), reduced ? 800 : EXHIBITION.enterHintDelay);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const enter = () => {
    if (leaving || !loaded) return;
    setLeaving(true);
    museumAudio.start();
    setTimeout(() => {
      setPhase("entering");
    }, reduced ? 200 : 1100);
  };

  if (phase !== "title") return null;

  return (
    <AnimatePresence>
      <motion.div
        key="titlewall"
        className="absolute inset-0 z-40 flex cursor-pointer items-center justify-center"
        onClick={enter}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          backgroundColor: leaving ? "#000000" : "#060608",
        }}
        transition={{ duration: reduced ? 0.3 : 2.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ backgroundColor: "#060608" }}
      >
        <IntroAtmosphere reduced={reduced} />

        <motion.div
          className="relative z-10 select-none px-8 text-center"
          animate={{ opacity: leaving ? 0 : 1, y: leaving ? -10 : 0 }}
          transition={{ duration: 1 }}
        >
          {EXHIBITION.intro ? (
            <motion.p
              className="mb-7 text-[11px] uppercase tracking-museum text-bone/40"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0.2 : 1.2, duration: 1.6 }}
            >
              {EXHIBITION.intro}
            </motion.p>
          ) : null}

          <motion.h1
            className="mx-auto max-w-4xl font-display text-4xl font-light leading-tight tracking-[0.06em] text-bone md:text-6xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0.2 : 1.6, duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {EXHIBITION.title}
            {EXHIBITION.subtitle ? (
              <span className="mt-2 block font-display text-2xl italic tracking-normal text-bone/75 md:text-4xl">
                {EXHIBITION.subtitle}
              </span>
            ) : null}
          </motion.h1>

          <motion.p
            className="mt-9 text-sm font-light uppercase tracking-[0.28em] text-bone/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0.3 : 2.6, duration: 1.8 }}
          >
            {EXHIBITION.dedication}
          </motion.p>
        </motion.div>

        <AnimatePresence>
          {showHint && !leaving && (
            <motion.div
              key="hint"
              className="absolute bottom-24 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2 }}
            >
              <span className="text-xs uppercase tracking-museum text-bone/65 animate-breathe">
                {loaded ? "Click anywhere to enter" : "Preparing the exhibition…"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
