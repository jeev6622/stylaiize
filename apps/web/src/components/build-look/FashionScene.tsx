"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FashionModel } from "./FashionModel";
import { FashionHotspot } from "./FashionHotspot";
import type { OutfitItem } from "./types";

interface FashionSceneProps {
  activeStage: number;
  highlightCategories: string[];
  activeItemId: string | null;
  autoRotate: boolean;
  items: OutfitItem[];
  onHotspotClick: (itemId: string) => void;
}

function useFinePointer(): boolean {
  const [isFine, setIsFine] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(pointer: fine)");
    const update = () => setIsFine(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isFine;
}

function LoadingFallback() {
  return (
    <mesh>
      <torusGeometry args={[0.3, 0.08, 16, 32]} />
      <meshStandardMaterial
        color="#8b5cf6"
        emissive="#8b5cf6"
        emissiveIntensity={0.5}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

function SceneContent({
  highlightCategories,
  activeItemId,
  autoRotate,
  items,
  onHotspotClick,
}: Omit<FashionSceneProps, "activeStage">) {
  const isFinePointer = useFinePointer();
  const visibleItems = useMemo(() => {
    if (highlightCategories.length === 0) return items;
    return items.filter((item) =>
      highlightCategories.some((cat) => item.category.toLowerCase().includes(cat.toLowerCase())),
    );
  }, [items, highlightCategories]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-2, 3, -2]} intensity={0.6} color="#e0d4ff" />
      <pointLight position={[0, -1, 3]} intensity={0.3} color="#8b5cf6" />

      <FashionModel
        highlightCategories={highlightCategories}
        activeItemId={activeItemId}
        autoRotate={autoRotate}
        items={items}
        onHotspotClick={onHotspotClick}
      />

      {visibleItems.map((item) => (
        <FashionHotspot
          key={item.id}
          position={item.hotspotPosition}
          label={item.name}
          isActive={activeItemId === item.id}
          onClick={() => onHotspotClick(item.id)}
        />
      ))}

      {isFinePointer && (
        <OrbitControls
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.5}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          minDistance={3}
          maxDistance={8}
        />
      )}
    </>
  );
}

export function FashionScene({
  activeStage: _activeStage,
  highlightCategories,
  activeItemId,
  autoRotate,
  items,
  onHotspotClick,
}: FashionSceneProps) {
  void _activeStage;
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 1.25]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 40, position: [0, 1.5, 5], near: 0.1, far: 100 }}
        style={{ background: "transparent", touchAction: "pan-y" }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <SceneContent
            highlightCategories={highlightCategories}
            activeItemId={activeItemId}
            autoRotate={autoRotate}
            items={items}
            onHotspotClick={onHotspotClick}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
