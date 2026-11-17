"use client";

/**
 * FashionModel — smart wrapper that auto-detects and loads the real GLB model
 * if available at public/models/stylaiize-fashion-model.glb, otherwise falls
 * back to the procedural geometry model.
 *
 * EXPECTED GLB MESH NAMING (case-insensitive):
 *   Jacket/Blazer → upperwear    Shirt/Top → upperwear
 *   Trousers/Pants → lowerwear   Shoes/Loafers → footwear
 *   Belt/Watch → accessories     Body/Head/Hair → body (never highlighted)
 */

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GLB_MODEL_PATH = "/models/stylaiize-fashion-model.glb";

// Check if GLB model file exists (HEAD request)
async function checkGLBExists(): Promise<boolean> {
  try {
    const res = await fetch(GLB_MODEL_PATH, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

// Categorize mesh name → outfit category
function categorizeMesh(name: string): string {
  const n = name.toLowerCase();
  if (/jacket|blazer|coat/.test(n)) return "upperwear";
  if (/shirt|top|blouse/.test(n)) return "upperwear";
  if (/trouser|pants|jeans|bottom/.test(n)) return "lowerwear";
  if (/shoe|loafer|boot|sneaker/.test(n)) return "footwear";
  if (/belt|watch|accessory|accessories/.test(n)) return "accessories";
  return "body";
}

export interface FashionModelProps {
  highlightCategories: string[];
  activeItemId: string | null;
  autoRotate: boolean;
  items: { id: string; hotspotPosition: [number, number, number]; category: string }[];
  onHotspotClick: (itemId: string) => void;
}

export function FashionModel(props: FashionModelProps) {
  const [useGLB, setUseGLB] = useState<boolean | null>(null);

  useEffect(() => {
    checkGLBExists().then(setUseGLB);
  }, []);

  // Still checking
  if (useGLB === null) return null;

  if (useGLB) {
    return (
      <GLBFashionModelInline
        highlightCategories={props.highlightCategories}
        activeItemId={props.activeItemId}
        autoRotate={props.autoRotate}
      />
    );
  }

  return (
    <ProceduralFashionModel
      highlightCategories={props.highlightCategories}
      activeItemId={props.activeItemId}
      autoRotate={props.autoRotate}
    />
  );
}

// ============================================================================
// GLB MODEL — loaded via three/examples GLTFLoader
// ============================================================================

function GLBFashionModelInline({
  highlightCategories,
  activeItemId: _activeItemId,
  autoRotate,
}: {
  highlightCategories: string[];
  activeItemId: string | null;
  autoRotate: boolean;
}) {
  void _activeItemId;
  const groupRef = useRef<THREE.Group>(null);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const materialsRef = useRef<Map<THREE.Mesh, THREE.MeshStandardMaterial>>(new Map());
  const separationDirRef = useRef<Map<THREE.Mesh, THREE.Vector3>>(new Map());
  const prevSepRef = useRef<Map<THREE.Mesh, number>>(new Map());
  const HIGHLIGHT_COLOR = useMemo(() => new THREE.Color("#06B6D4"), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const loader = new GLTFLoader();
        const gltf = await new Promise<THREE.Group>((resolve, reject) => {
          loader.load(GLB_MODEL_PATH, (g) => resolve(g.scene), undefined, reject);
        });
        if (cancelled) return;

        // Setup materials and separation directions
        gltf.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat && "emissiveIntensity" in mat) {
              materialsRef.current.set(child, mat);
              mat.emissive = mat.emissive.clone();

              const box = new THREE.Box3().setFromObject(child);
              const center = box.getCenter(new THREE.Vector3());
              const len = Math.sqrt(center.x * center.x + center.z * center.z);
              separationDirRef.current.set(
                child,
                len > 0.01
                  ? new THREE.Vector3(center.x / len, 0, center.z / len)
                  : new THREE.Vector3(0, 0, 0),
              );
              prevSepRef.current.set(child, 0);
            }
          }
        });

        setScene(gltf);
      } catch (err) {
        console.warn("[StylAIze] GLB load failed, will use procedural fallback:", err);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Per-frame highlight and separation animation
  useFrame((_, delta) => {
    if (!groupRef.current || !scene) return;

    groupRef.current.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const mat = materialsRef.current.get(child);
      if (!mat) return;

      const category = categorizeMesh(child.name || (child.userData?.name as string) || "");
      const isHighlighted = highlightCategories.includes(category);

      // Smooth emissive
      const targetEmissive = isHighlighted ? 0.4 : 0;
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * Math.min(delta * 6, 1);
      if (isHighlighted) {
        mat.emissive.lerp(HIGHLIGHT_COLOR, Math.min(delta * 6, 1));
      }

      // Smooth separation
      const sepDir = separationDirRef.current.get(child);
      if (sepDir) {
        const targetSep = isHighlighted ? 0.08 : 0;
        const currentSep = prevSepRef.current.get(child) ?? 0;
        const newSep = currentSep + (targetSep - currentSep) * Math.min(delta * 6, 1);
        child.position.x += sepDir.x * (newSep - currentSep);
        child.position.z += sepDir.z * (newSep - currentSep);
        prevSepRef.current.set(child, newSep);
      }
    });
  });

  // Auto-rotation
  useFrame((state) => {
    if (!groupRef.current || !autoRotate) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
  });

  if (!scene) return null;

  return (
    <group ref={groupRef} position={[0, -0.9, 0]}>
      <primitive object={scene} />
    </group>
  );
}

// ============================================================================
// PROCEDURAL FALLBACK — box/capsule geometry mannequin
// ============================================================================

const CATEGORY_PART_MAP: Record<string, string[]> = {
  upperwear: ["torso", "leftShoulder", "rightShoulder", "leftArm", "rightArm"],
  lowerwear: ["leftLeg", "rightLeg"],
  footwear: ["leftFoot", "rightFoot"],
  accessories: ["head"],
};

const IDLE_COLOR = "#1a1a2e";
const HIGHLIGHT_COLOR_PROC = "#06B6D4";

interface BodyPart {
  name: string;
  categories: string[];
  geometry: "box" | "sphere" | "capsule" | "cylinder";
  position: [number, number, number];
  scale: [number, number, number];
  args?: number[];
}

const BODY_PARTS: BodyPart[] = [
  { name: "head", categories: ["accessories"], geometry: "sphere", position: [0, 2.15, 0], scale: [0.22, 0.28, 0.22] },
  { name: "neck", categories: ["accessories"], geometry: "cylinder", position: [0, 1.85, 0], scale: [0.08, 1, 0.08], args: [0.08, 0.08, 0.15, 16] },
  { name: "torso", categories: ["upperwear"], geometry: "box", position: [0, 1.3, 0], scale: [0.55, 0.7, 0.3] },
  { name: "leftShoulder", categories: ["upperwear"], geometry: "box", position: [-0.38, 1.6, 0], scale: [0.18, 0.12, 0.22] },
  { name: "rightShoulder", categories: ["upperwear"], geometry: "box", position: [0.38, 1.6, 0], scale: [0.18, 0.12, 0.22] },
  { name: "leftArm", categories: ["upperwear"], geometry: "capsule", position: [-0.42, 1.2, 0], scale: [0.06, 1, 0.06] },
  { name: "rightArm", categories: ["upperwear"], geometry: "capsule", position: [0.42, 1.2, 0], scale: [0.06, 1, 0.06] },
  { name: "leftLeg", categories: ["lowerwear"], geometry: "cylinder", position: [-0.15, 0.45, 0], scale: [0.09, 1, 0.09], args: [0.09, 0.08, 0.85, 16] },
  { name: "rightLeg", categories: ["lowerwear"], geometry: "cylinder", position: [0.15, 0.45, 0], scale: [0.09, 1, 0.09], args: [0.09, 0.08, 0.85, 16] },
  { name: "leftFoot", categories: ["footwear"], geometry: "box", position: [-0.15, -0.02, 0.04], scale: [0.1, 0.06, 0.18] },
  { name: "rightFoot", categories: ["footwear"], geometry: "box", position: [0.15, -0.02, 0.04], scale: [0.1, 0.06, 0.18] },
];

function BodyPartMesh({
  part,
  highlightCategories,
}: {
  part: BodyPart;
  highlightCategories: string[];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const isHighlighted = useMemo(() => {
    return highlightCategories.some((cat) => {
      const mapped = CATEGORY_PART_MAP[cat];
      return mapped ? mapped.includes(part.name) : part.categories.includes(cat);
    });
  }, [highlightCategories, part]);

  const targetEmissive = useRef(0);
  const targetSeparation = useRef(0);

  const separationDir = useMemo(() => {
    const [x, , z] = part.position;
    const len = Math.sqrt(x * x + z * z);
    if (len < 0.01) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(x / len, 0, z / len);
  }, [part.position]);

  useFrame((_, delta) => {
    if (!materialRef.current || !meshRef.current) return;

    const targetE = isHighlighted ? 0.35 : 0;
    targetEmissive.current += (targetE - targetEmissive.current) * Math.min(delta * 6, 1);
    materialRef.current.emissiveIntensity = targetEmissive.current;

    const targetS = isHighlighted ? 0.1 : 0;
    targetSeparation.current += (targetS - targetSeparation.current) * Math.min(delta * 6, 1);

    meshRef.current.position.set(
      part.position[0] + separationDir.x * targetSeparation.current,
      part.position[1],
      part.position[2] + separationDir.z * targetSeparation.current,
    );
  });

  const color = isHighlighted ? HIGHLIGHT_COLOR_PROC : IDLE_COLOR;

  const commonMaterial = (
    <meshStandardMaterial
      ref={materialRef}
      color={color}
      emissive={HIGHLIGHT_COLOR_PROC}
      emissiveIntensity={0}
      roughness={0.45}
      metalness={0.55}
    />
  );

  if (part.geometry === "sphere") {
    return (
      <mesh ref={meshRef} position={part.position} castShadow>
        <sphereGeometry args={[1, 24, 24]} />
        {commonMaterial}
      </mesh>
    );
  }

  if (part.geometry === "capsule") {
    return (
      <mesh ref={meshRef} position={part.position} castShadow>
        <capsuleGeometry args={[1, 0.4, 8, 16]} />
        {commonMaterial}
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} position={part.position} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      {commonMaterial}
    </mesh>
  );
}

function Particles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 80;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 1] = Math.random() * 3.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#8b5cf6"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

function ProceduralFashionModel({
  highlightCategories,
  activeItemId: _activeItemId,
  autoRotate,
}: {
  highlightCategories: string[];
  activeItemId: string | null;
  autoRotate: boolean;
}) {
  void _activeItemId;
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (autoRotate) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.9, 0]}>
      {BODY_PARTS.map((part) => (
        <BodyPartMesh
          key={part.name}
          part={part}
          highlightCategories={highlightCategories}
        />
      ))}
      <Particles />
    </group>
  );
}
