"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RotateCw } from "lucide-react";
import { FashionModel } from "./FashionModel";
import { FashionHotspot } from "./FashionHotspot";
import {
  FASHION_MODEL_ACCEPTED_LICENSES,
  FASHION_MODEL_LICENSE_FILE,
  FASHION_MODEL_LICENSE_FORMAT,
  FASHION_MODEL_REQUIREMENTS,
  getFashionModelAsset,
  type FashionModelId,
  type FashionView,
} from "./fashion-model-catalog";
import { useFashionModels, type FashionModelState } from "./useFashionModels";
import type { OutfitGarmentSlot, OutfitPiece } from "./types";

interface FashionSceneProps {
  modelId: FashionModelId;
  allowedModelIds: FashionModelId[];
  onModelIdChange: (id: FashionModelId) => void;
  autoRotate: boolean;
  onAutoRotateChange: (enabled: boolean) => void;
  highlightCategories: string[];
  activeItemId: string | null;
  pieces: OutfitPiece[];
  selectedSlot: OutfitGarmentSlot | null;
  onHotspotClick: (itemId: string) => void;
}

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

const VIEW_OPTIONS: ReadonlyArray<{ id: FashionView; label: string }> = [
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
  { id: "back", label: "Back" },
];

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function statusCopy(state: FashionModelState): { title: string; detail: string } {
  const acceptedLicenses = FASHION_MODEL_ACCEPTED_LICENSES.join(" or ");

  switch (state.status) {
    case "checking":
      return {
        title: "Checking licensed fashion model",
        detail: `Verifying ${state.asset.fileName} and its licence record in ${FASHION_MODEL_LICENSE_FILE}.`,
      };
    case "license-unverified":
      return {
        title: "Licensed human model is not configured",
        detail: `Add ${state.asset.fileName} and a matching ${FASHION_MODEL_LICENSE_FILE} entry using: ${FASHION_MODEL_LICENSE_FORMAT}. Accepted licences: ${acceptedLicenses}. No primitive substitute will be rendered.`,
      };
    case "missing":
      return {
        title: "Realistic human model is not provisioned",
        detail: `Missing ${state.asset.path}. No primitive substitute will be rendered.`,
      };
    case "loading":
      return {
        title: "Loading fashion model",
        detail: "Preparing licensed geometry, PBR materials, and textures.",
      };
    case "error":
      return {
        title: "Model validation failed",
        detail: state.error ?? "The GLB could not be loaded with its required textures.",
      };
    default:
      return { title: "Model unavailable", detail: state.asset.path };
  }
}

function SceneContent({
  scene,
  view,
  highlightCategories,
  activeItemId,
  selectedSlot,
  autoRotate,
  pieces,
  onHotspotClick,
  controlsRef,
  isMobile,
  controlsEnabled,
}: {
  scene: NonNullable<FashionModelState["scene"]>;
  view: FashionView;
  highlightCategories: string[];
  activeItemId: string | null;
  selectedSlot: OutfitGarmentSlot | null;
  autoRotate: boolean;
  pieces: OutfitPiece[];
  onHotspotClick: (itemId: string) => void;
  controlsRef: RefObject<OrbitControlsRef | null>;
  isMobile: boolean;
  controlsEnabled: boolean;
}) {
  const visiblePieces = selectedSlot
    ? pieces.filter((piece) => piece.slot === selectedSlot)
    : highlightCategories.length
      ? pieces.filter((piece) =>
          highlightCategories.some((category) =>
            piece.category.toLowerCase().includes(category.toLowerCase()),
          ),
        )
      : pieces;

  return (
    <>
      <hemisphereLight args={["#f8fafc", "#0b1020", 0.6]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[3, 4.5, 3]}
        intensity={1.5}
        castShadow
        shadow-bias={-0.0002}
        shadow-mapSize-width={isMobile ? 512 : 1024}
        shadow-mapSize-height={isMobile ? 512 : 1024}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
      />
      <spotLight position={[-3, 3, -2]} angle={0.6} penumbra={0.9} intensity={14} color="#dbeafe" />
      <spotLight position={[2.5, 2, -3]} angle={0.7} penumbra={1} intensity={10} color="#67e8f9" />

      <Environment frames={1} resolution={isMobile ? 128 : 256} background={false}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#ffffff"
          position={[0, 3, 2]}
          scale={[4, 2, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#dbeafe"
          position={[-3, 2, 1]}
          scale={[2, 3, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#ffe4d6"
          position={[3, 1.5, -2]}
          scale={[3, 2, 1]}
          target={[0, 1, 0]}
        />
      </Environment>

      <FashionModel
        scene={scene}
        view={view}
        highlightCategories={highlightCategories}
        pieces={pieces}
        activePieceId={activeItemId}
        selectedSlot={selectedSlot}
      />

      <ContactShadows
        position={[0, 0.01, 0]}
        scale={4}
        opacity={0.45}
        blur={2.5}
        far={3.5}
        resolution={isMobile ? 256 : 512}
        color="#020617"
      />

      {visiblePieces.map((piece) => (
        <FashionHotspot
          key={piece.id}
          position={piece.hotspotPosition}
          label={piece.name}
          subtitle={
            piece.product
              ? `${piece.product.brand ?? piece.product.store} · ${piece.product.currency} ${piece.product.price.toLocaleString("en-IN")}`
              : "3D approximation"
          }
          hasProduct={Boolean(piece.product)}
          isActive={activeItemId === piece.id}
          onClick={() => onHotspotClick(piece.id)}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        autoRotate={autoRotate && controlsEnabled}
        autoRotateSpeed={0.7}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        enableRotate={controlsEnabled}
        enableZoom={controlsEnabled}
        minDistance={2.5}
        maxDistance={6.5}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.35}
        target={[0, 0.9, 0]}
      />
    </>
  );
}

export function FashionScene({
  modelId,
  allowedModelIds,
  onModelIdChange,
  autoRotate,
  onAutoRotateChange,
  highlightCategories,
  activeItemId,
  pieces,
  selectedSlot,
  onHotspotClick,
}: FashionSceneProps) {
  const [view, setView] = useState<FashionView>("front");
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const state = useFashionModels(modelId);
  const controlsRef = useRef<OrbitControlsRef>(null);
  const copy = statusCopy(state);
  const isReady = state.status === "ready" && state.scene !== null;

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.reset();
    controls.target.set(0, 0.9, 0);
    controls.setAzimuthalAngle(0);
    controls.setPolarAngle(Math.PI / 2);
    controls.update();
  }, [view, modelId, state.status]);

  useEffect(() => {
    if (!selectedSlot) return;
    setView(selectedSlot === "footwear" || selectedSlot === "accessory" ? "side" : "front");
  }, [selectedSlot]);

  const changeZoom = useCallback((zoomIn: boolean) => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (zoomIn) controls.dollyIn(1.2);
    else controls.dollyOut(1.2);
    controls.update();
  }, []);

  if (!isReady || !state.scene) {
    return (
      <div className="flex min-h-[360px] w-full items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-center">
          <div
            className={`mx-auto mb-4 h-10 w-10 rounded-full border-2 border-white/20 border-t-cyan-300 ${
              state.status === "checking" || state.status === "loading" ? "animate-spin" : ""
            }`}
          />
          <h3 className="text-base font-semibold text-white">{copy.title}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{copy.detail}</p>
          {state.status === "license-unverified" && (
            <ul className="mt-3 space-y-1 text-left text-[11px] leading-relaxed text-slate-400">
              {FASHION_MODEL_REQUIREMENTS.map((requirement) => (
                <li key={requirement}>- {requirement}</li>
              ))}
            </ul>
          )}
          {state.issues.length > 0 && state.status !== "license-unverified" && (
            <p className="mt-3 text-[11px] text-amber-200/80">{state.issues.join(" ")}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-white/5 bg-slate-950/40 px-3 py-3">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {allowedModelIds.map((id) => {
            const option = getFashionModelAsset(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onModelIdChange(id)}
                aria-pressed={modelId === id}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  modelId === id ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {option.group}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              aria-pressed={view === option.id}
              aria-label={`${option.label} view`}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                view === option.id ? "bg-cyan-400/15 text-cyan-100" : "text-slate-400 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => changeZoom(false)}
            aria-label="Zoom out"
            className="rounded-full px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => changeZoom(true)}
            aria-label="Zoom in"
            className="rounded-full px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onAutoRotateChange(!autoRotate)}
            aria-pressed={autoRotate}
            aria-label="Toggle 360 degree rotation"
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
              autoRotate ? "bg-cyan-400/15 text-cyan-100" : "text-slate-300 hover:text-white"
            }`}
          >
            <RotateCw className="h-3 w-3" />
            360
          </button>
          {isMobile && (
            <button
              type="button"
              onClick={() => setControlsEnabled((enabled) => !enabled)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold text-slate-300 hover:text-white"
            >
              {controlsEnabled ? "Scroll" : "Rotate"}
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-[340px] w-full flex-1 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_65%)]">
        <Canvas
          shadows
          dpr={[1, isMobile ? 1 : 1.5]}
          gl={{
            antialias: !isMobile,
            alpha: true,
            powerPreference: isMobile ? "default" : "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
          camera={{ fov: 40, position: [0, 1.1, isMobile ? 4.6 : 4.2], near: 0.1, far: 100 }}
          style={{ background: "transparent", touchAction: controlsEnabled ? "none" : "pan-y" }}
        >
          <SceneContent
            scene={state.scene}
            view={view}
            highlightCategories={highlightCategories}
            activeItemId={activeItemId}
            selectedSlot={selectedSlot}
            autoRotate={autoRotate}
            pieces={pieces}
            onHotspotClick={onHotspotClick}
            controlsRef={controlsRef}
            isMobile={isMobile}
            controlsEnabled={controlsEnabled}
          />
        </Canvas>
      </div>

      <div className="space-y-1 border-t border-white/5 bg-slate-950/40 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
        <p>{controlsEnabled ? "Drag to rotate. Pinch or scroll to zoom." : "Model view locked for page scrolling."}</p>
        <p className="text-amber-200/80">
          3D preview uses parametric garment approximations or exact product GLBs when supplied.
        </p>
        {state.license && (
          <p>
            Avatar asset: {state.asset.label} - {state.license.identifier}
          </p>
        )}
      </div>
    </div>
  );
}
