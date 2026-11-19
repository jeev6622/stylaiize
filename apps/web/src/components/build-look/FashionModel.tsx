"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  VIEW_YAW,
  categorizeFashionMesh,
  type FashionView,
} from "./fashion-model-catalog";
import { OutfitGarments } from "./OutfitGarments";
import type { OutfitGarmentSlot, OutfitPiece } from "./types";

interface FashionModelProps {
  scene: THREE.Group;
  view: FashionView;
  highlightCategories: string[];
  pieces: OutfitPiece[];
  activePieceId: string | null;
  selectedSlot: OutfitGarmentSlot | null;
}

interface HighlightBinding {
  material: THREE.MeshStandardMaterial;
  category: ReturnType<typeof categorizeFashionMesh>;
  baseEmissive: THREE.Color;
  baseIntensity: number;
}

const HIGHLIGHT_COLOR = new THREE.Color("#06b6d4");

function shortestAngleDelta(current: number, target: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export function FashionModel({
  scene,
  view,
  highlightCategories,
  pieces,
  activePieceId,
  selectedSlot,
}: FashionModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetYaw = VIEW_YAW[view];

  const bindings = useMemo(() => {
    const result: HighlightBinding[] = [];
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const category = categorizeFashionMesh(object.name, object.userData.category);
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        result.push({
          material,
          category,
          baseEmissive: material.emissive.clone(),
          baseIntensity: material.emissiveIntensity,
        });
      }
    });
    return result;
  }, [scene]);

  useEffect(() => {
    const hideBakedGarments = pieces.length > 0;
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const category = categorizeFashionMesh(object.name, object.userData.category);
      if (category !== "body" && category !== undefined) {
        object.visible = !hideBakedGarments;
      }
    });
  }, [pieces.length, scene]);

  useFrame((_, delta) => {
    const blend = Math.min(delta * 6, 1);
    if (groupRef.current) {
      const currentYaw = groupRef.current.rotation.y;
      groupRef.current.rotation.y += shortestAngleDelta(currentYaw, targetYaw) * blend;
    }

    for (const binding of bindings) {
      const highlighted = highlightCategories.includes(binding.category);
      const targetIntensity = highlighted ? 0.32 : binding.baseIntensity;
      const targetColor = highlighted ? HIGHLIGHT_COLOR : binding.baseEmissive;
      binding.material.emissiveIntensity +=
        (targetIntensity - binding.material.emissiveIntensity) * blend;
      binding.material.emissive.lerp(targetColor, blend);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
      {pieces.length > 0 && (
        <OutfitGarments
          pieces={pieces}
          activePieceId={activePieceId}
          selectedSlot={selectedSlot}
        />
      )}
    </group>
  );
}
