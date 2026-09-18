"use client";

import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { ENTRY_HERO } from "@/lib/config";
import { printSize } from "./Artwork";

/** Nudge the print forward so it never shares a depth plane with the wall. */
const PRINT_OFFSET = 0.04;

class TextureBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — the fallback is shown */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function HeroPlaceholder({ w, h }: { w: number; h: number }) {
  return (
    <mesh position={[0, 0, PRINT_OFFSET]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color="#6a6560" roughness={0.95} />
    </mesh>
  );
}

function EntryHeroFrameInner({ src }: { src: string }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const texture = useTexture(encodeURI(src));
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    const img = texture.image as { width?: number; height?: number } | undefined;
    if (img?.width && img?.height) setAspect(img.width / img.height);
  }, [texture]);

  const [w, h] = printSize(aspect, ENTRY_HERO.scale);

  return (
    <group position={ENTRY_HERO.position} rotation={ENTRY_HERO.rotation}>
      <primitive object={target} position={[0, 0, PRINT_OFFSET]} />

      <spotLight
        target={target}
        position={[0, 2.85, 3.4]}
        intensity={52}
        angle={0.52}
        penumbra={0.9}
        distance={18}
        decay={1.5}
        color="#ffe8b0"
      />

      <mesh position={[0, 0, PRINT_OFFSET]} renderOrder={2}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={texture}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.18}
          roughness={0.9}
          metalness={0}
          toneMapped={true}
          polygonOffset={true}
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-4}
        />
      </mesh>
    </group>
  );
}

/**
 * Monumental entry piece — displays ENTRY_HERO on the north wall, centred on
 * the walk-in sightline. Single plane only (image includes the frame).
 */
export function EntryHeroFrame({ src }: { src: string }) {
  const [w, h] = printSize(16 / 9, ENTRY_HERO.scale);

  const shell = (
    <group position={ENTRY_HERO.position} rotation={ENTRY_HERO.rotation}>
      <HeroPlaceholder w={w} h={h} />
    </group>
  );

  return (
    <TextureBoundary fallback={shell}>
      <Suspense fallback={shell}>
        <EntryHeroFrameInner src={src} />
      </Suspense>
    </TextureBoundary>
  );
}
