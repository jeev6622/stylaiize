"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface FashionHotspotProps {
  position: [number, number, number];
  label: string;
  subtitle: string;
  hasProduct: boolean;
  isActive: boolean;
  onClick: () => void;
}

const COLOR_DEFAULT = "#94a3b8";
const COLOR_ACTIVE = "#22d3ee";

export function FashionHotspot({
  position,
  label,
  subtitle,
  hasProduct,
  isActive,
  onClick,
}: FashionHotspotProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(
    () => () => {
      document.body.style.cursor = "auto";
    },
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    groupRef.current.position.y = position[1] + Math.sin(t * 1.5 + position[0] * 2) * 0.025;

    if (ringRef.current) {
      const pulseScale = 1 + Math.sin(t * 2.5) * 0.14;
      ringRef.current.scale.setScalar(pulseScale);
      const ringMat = ringRef.current.material as THREE.MeshStandardMaterial;
      ringMat.opacity = isActive || hovered ? 0.4 : 0.18;
    }

    if (glowRef.current) {
      const targetScale = isActive || hovered ? 0.08 : 0.045;
      const currentScale = glowRef.current.scale.x;
      glowRef.current.scale.setScalar(currentScale + (targetScale - currentScale) * 0.1);
    }
  });

  const color = isActive || hovered ? COLOR_ACTIVE : COLOR_DEFAULT;

  return (
    <group ref={groupRef} position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive || hovered ? 1 : 0.35}
          roughness={0.35}
          metalness={0.5}
        />
      </mesh>

      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.1}
          roughness={1}
        />
      </mesh>

      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.045, 0.06, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>

      {isActive && (
        <Html position={[0, 0.12, 0]} center distanceFactor={5} zIndexRange={[30, 10]}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
            aria-label={`Select ${label}`}
            className="w-40 rounded-lg border border-cyan-300/50 bg-slate-950/95 px-3 py-2 text-left shadow-xl backdrop-blur"
          >
            <span className="block truncate text-[11px] font-semibold text-white">{label}</span>
            <span className={`mt-0.5 block truncate text-[10px] ${hasProduct ? "text-cyan-200/80" : "text-amber-200/80"}`}>
              {hasProduct ? subtitle : "No verified product found."}
            </span>
          </button>
        </Html>
      )}
    </group>
  );
}
