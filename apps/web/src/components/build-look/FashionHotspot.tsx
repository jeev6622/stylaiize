"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface FashionHotspotProps {
  position: [number, number, number];
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const COLOR_DEFAULT = "#8b5cf6";
const COLOR_ACTIVE = "#06B6D4";

export function FashionHotspot({
  position,
  label,
  isActive,
  onClick,
}: FashionHotspotProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    groupRef.current.position.y =
      position[1] + Math.sin(t * 1.5 + position[0] * 2) * 0.04;

    if (ringRef.current) {
      const pulseScale = 1 + Math.sin(t * 2.5) * 0.2;
      ringRef.current.scale.setScalar(pulseScale);
      const ringMat = ringRef.current.material as THREE.MeshStandardMaterial;
      ringMat.opacity = isActive || hovered ? 0.5 + Math.sin(t * 3) * 0.15 : 0.25 + Math.sin(t * 2) * 0.1;
    }

    if (glowRef.current) {
      const targetScale = isActive || hovered ? 0.12 : 0.06;
      const currentScale = glowRef.current.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * 0.1;
      glowRef.current.scale.setScalar(newScale);
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
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive || hovered ? 1.2 : 0.5}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.15}
          roughness={1}
        />
      </mesh>

      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.08, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Html
        center
        distanceFactor={4}
        style={{
          pointerEvents: "none",
          userSelect: "none",
        }}
        occlude={false}
      >
        <div
          style={{
            transform: isActive || hovered ? "translateY(-8px) scale(1.05)" : "translateY(-8px)",
            opacity: isActive || hovered ? 1 : 0.8,
            transition: "all 0.2s ease",
            background: isActive
              ? "linear-gradient(135deg, rgba(6,182,212,0.9), rgba(6,182,212,0.7))"
              : "linear-gradient(135deg, rgba(139,92,246,0.85), rgba(139,92,246,0.65))",
            backdropFilter: "blur(12px)",
            border: `1px solid ${isActive ? "rgba(6,182,212,0.4)" : "rgba(139,92,246,0.3)"}`,
            borderRadius: "8px",
            padding: "4px 10px",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap",
            boxShadow: isActive
              ? "0 0 20px rgba(6,182,212,0.3)"
              : "0 0 12px rgba(139,92,246,0.2)",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}
