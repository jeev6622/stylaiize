"use client";

import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { OutfitGarmentSlot, OutfitPiece } from "@/components/build-look/types";
import { buildProductModel3dProxyUrl } from "@/lib/outfit-pieces";

interface OutfitGarmentsProps {
  pieces: OutfitPiece[];
  activePieceId: string | null;
  selectedSlot: OutfitGarmentSlot | null;
}

interface ExactProductModelProps {
  piece: OutfitPiece;
  onError: () => void;
}

const SLOT_ORDER: Record<OutfitGarmentSlot, number> = {
  bottom: 0,
  footwear: 0,
  top: 1,
  accessory: 2,
  outerwear: 3,
};

const TARGET_SIZE: Record<OutfitGarmentSlot, [number, number, number]> = {
  top: [0.7, 0.75, 0.45],
  outerwear: [0.85, 0.85, 0.55],
  bottom: [0.5, 1.0, 0.45],
  footwear: [0.5, 0.2, 0.55],
  accessory: [0.5, 0.5, 0.5],
};

const TARGET_POSITION: Record<OutfitGarmentSlot, [number, number, number]> = {
  top: [0, 1.25, 0],
  outerwear: [0, 1.25, 0.02],
  bottom: [0, 0.58, 0],
  footwear: [0, 0.06, 0.05],
  accessory: [0, 1.52, 0],
};

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

function fitToSlot(root: THREE.Object3D, slot: OutfitGarmentSlot): void {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const target = TARGET_SIZE[slot];
  const scale = Math.min(
    target[0] / Math.max(size.x, 0.001),
    target[1] / Math.max(size.y, 0.001),
    target[2] / Math.max(size.z, 0.001),
  );
  const position = TARGET_POSITION[slot];

  root.scale.setScalar(scale);
  root.position.set(position[0] - center.x * scale, position[1] - bounds.min.y * scale, position[2] - center.z * scale);
  root.updateMatrixWorld(true);
}

function ExactProductModel({ piece, onError }: ExactProductModelProps) {
  const [object, setObject] = useState<THREE.Group | null>(null);
  const modelUrl = piece.product?.model3dUrl ?? "";

  useEffect(() => {
    let cancelled = false;
    let loaded: THREE.Group | null = null;
    setObject(null);

    void import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => {
        const loader = new GLTFLoader();
        return loader.loadAsync(buildProductModel3dProxyUrl(modelUrl));
      })
      .then((gltf) => {
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }
        if (piece.slot) fitToSlot(gltf.scene, piece.slot);
        loaded = gltf.scene;
        setObject(gltf.scene);
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
      if (loaded) disposeObject(loaded);
    };
  }, [modelUrl, onError, piece.slot]);

  return object ? <primitive object={object} /> : null;
}

function GarmentMaterial({
  piece,
  highlighted,
}: {
  piece: OutfitPiece;
  highlighted: boolean;
}) {
  return (
    <meshStandardMaterial
      color={piece.colorHex}
      roughness={piece.slot === "accessory" ? 0.35 : 0.78}
      metalness={piece.slot === "accessory" ? 0.35 : 0.04}
      emissive={highlighted ? "#06b6d4" : "#000000"}
      emissiveIntensity={highlighted ? 0.32 : 0}
    />
  );
}

function ParametricGarment({
  piece,
  highlighted,
}: {
  piece: OutfitPiece;
  highlighted: boolean;
}) {
  if (!piece.slot) return null;

  if (piece.slot === "outerwear") {
    return (
      <group>
        <mesh position={[-0.2, 1.25, 0.04]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.66, 0.42]} />
          <GarmentMaterial piece={piece} highlighted={highlighted} />
        </mesh>
        <mesh position={[0.2, 1.25, 0.04]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.66, 0.42]} />
          <GarmentMaterial piece={piece} highlighted={highlighted} />
        </mesh>
        <mesh position={[0, 1.25, -0.19]} castShadow receiveShadow>
          <boxGeometry args={[0.54, 0.66, 0.08]} />
          <GarmentMaterial piece={piece} highlighted={highlighted} />
        </mesh>
      </group>
    );
  }

  if (piece.slot === "top") {
    return (
      <mesh position={[0, 1.26, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.31, 0.5, 8, 18]} />
        <GarmentMaterial piece={piece} highlighted={highlighted} />
      </mesh>
    );
  }

  if (piece.slot === "bottom") {
    return (
      <group>
        <mesh position={[-0.13, 0.58, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.13, 0.58, 8, 16]} />
          <GarmentMaterial piece={piece} highlighted={highlighted} />
        </mesh>
        <mesh position={[0.13, 0.58, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.13, 0.58, 8, 16]} />
          <GarmentMaterial piece={piece} highlighted={highlighted} />
        </mesh>
      </group>
    );
  }

  if (piece.slot === "footwear") {
    return (
      <group>
        <mesh position={[-0.14, 0.06, 0.05]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.11, 0.34]} />
          <GarmentMaterial piece={piece} highlighted={highlighted} />
        </mesh>
        <mesh position={[0.14, 0.06, 0.05]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.11, 0.34]} />
          <GarmentMaterial piece={piece} highlighted={highlighted} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={TARGET_POSITION.accessory} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={[0.18, 0.035, 8, 20]} />
      <GarmentMaterial piece={piece} highlighted={highlighted} />
    </mesh>
  );
}

function ProductImageFallback({ piece }: { piece: OutfitPiece }) {
  const imageUrl = piece.imageUrl;
  if (!imageUrl) return null;
  const safeImageUrl = imageUrl.replace(/["\\]/g, "\\$&");

  return (
    <Html
      position={piece.hotspotPosition}
      center
      distanceFactor={5}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        role="img"
        aria-label={piece.name}
        className="h-24 w-24 rounded-lg border border-cyan-300/40 bg-slate-950/90 bg-cover bg-center shadow-xl"
        style={{ backgroundImage: `url("${safeImageUrl}")` }}
      />
    </Html>
  );
}

export function OutfitGarments({ pieces, activePieceId, selectedSlot }: OutfitGarmentsProps) {
  const [failedExactPieceIds, setFailedExactPieceIds] = useState<Set<string>>(() => new Set());
  const sorted = [...pieces].sort(
    (left, right) =>
      SLOT_ORDER[left.slot ?? "accessory"] - SLOT_ORDER[right.slot ?? "accessory"],
  );

  return (
    <group>
      {sorted.map((piece) => {
        const highlighted = piece.id === activePieceId || piece.slot === selectedSlot;
        const useExact = piece.renderMode === "exact" && !failedExactPieceIds.has(piece.id);

        if (useExact) {
          return (
            <ExactProductModel
              key={piece.id}
              piece={piece}
              onError={() =>
                setFailedExactPieceIds((current) => new Set(current).add(piece.id))
              }
            />
          );
        }

        if (piece.slot) {
          return <ParametricGarment key={piece.id} piece={piece} highlighted={highlighted} />;
        }

        return <ProductImageFallback key={piece.id} piece={piece} />;
      })}
    </group>
  );
}
