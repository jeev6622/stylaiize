"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  FASHION_MODEL_ACCEPTED_LICENSES,
  FASHION_MODEL_ASSETS,
  FASHION_MODEL_LICENSE_FILE,
  getFashionModelAsset,
  type FashionLicenseRecord,
  type FashionModelAsset,
  type FashionModelId,
} from "./fashion-model-catalog";

export type FashionModelStatus =
  | "checking"
  | "license-unverified"
  | "missing"
  | "loading"
  | "ready"
  | "error";

export interface FashionModelState {
  status: FashionModelStatus;
  asset: FashionModelAsset;
  scene: THREE.Group | null;
  license: FashionLicenseRecord | null;
  issues: string[];
  blockingIssues: string[];
  licenseIssues: string[];
  availableAssets: string[];
  missingAssets: string[];
  error: string | null;
}

interface PreparedModel {
  scene: THREE.Group;
  issues: string[];
  blockingIssues: string[];
}

const availabilityCache = new Map<string, Promise<boolean>>();
const licenseCache = new Map<string, Promise<FashionLicenseRecord[]>>();
const modelCache = new Map<string, Promise<PreparedModel>>();

const TEXTURE_KEYS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
  "bumpMap",
  "displacementMap",
  "lightMap",
] as const;

const ACCEPTED_LICENSE_IDS: readonly string[] = FASHION_MODEL_ACCEPTED_LICENSES;

function normalizeLicenseId(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

function parseLicenseRecords(contents: string): FashionLicenseRecord[] {
  const records: FashionLicenseRecord[] = [];
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [fileName, identifier, name, holder, source] = line
      .split("|")
      .map((part) => part.trim());
    if (!fileName || !identifier || !name || !holder || !source) continue;
    if (!/^https?:\/\//i.test(source)) continue;
    records.push({ fileName, identifier, name, holder, source });
  }
  return records;
}

function probeAsset(path: string): Promise<boolean> {
  const cached = availabilityCache.get(path);
  if (cached) return cached;
  const request = fetch(path, { method: "HEAD", cache: "no-store" })
    .then((response) => response.ok)
    .catch(() => false);
  availabilityCache.set(path, request);
  return request;
}

function loadLicenseRecords(): Promise<FashionLicenseRecord[]> {
  const cached = licenseCache.get(FASHION_MODEL_LICENSE_FILE);
  if (cached) return cached;
  const request = fetch(FASHION_MODEL_LICENSE_FILE, { cache: "no-store" })
    .then((response) => (response.ok ? response.text() : ""))
    .then(parseLicenseRecords)
    .catch(() => []);
  licenseCache.set(FASHION_MODEL_LICENSE_FILE, request);
  return request;
}

function verifyAssetLicense(
  asset: FashionModelAsset,
  records: readonly FashionLicenseRecord[],
): { record: FashionLicenseRecord | null; issue: string | null } {
  const record = records.find((item) => item.fileName === asset.fileName);
  if (!record) {
    return { record: null, issue: `${asset.fileName}: no entry in ${FASHION_MODEL_LICENSE_FILE}` };
  }
  if (!ACCEPTED_LICENSE_IDS.includes(normalizeLicenseId(record.identifier))) {
    return {
      record: null,
      issue: `${asset.fileName}: licence '${record.identifier}' is not accepted`,
    };
  }
  return { record, issue: null };
}

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function validateMaterials(root: THREE.Object3D): {
  issues: string[];
  blockingIssues: string[];
} {
  const issues: string[] = [];
  const blockingIssues: string[] = [];
  let pbrMaterialCount = 0;
  let textureCount = 0;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = materialsOf(object);
    if (materials.length === 0) {
      blockingIssues.push(`${object.name || "mesh"}: no material assigned`);
      return;
    }

    materials.forEach((material, index) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) {
        issues.push(`${object.name || "mesh"}[${index}]: not a PBR material`);
        return;
      }
      pbrMaterialCount += 1;

      for (const key of TEXTURE_KEYS) {
        const texture = material[key] as THREE.Texture | null | undefined;
        if (!texture) continue;
        textureCount += 1;
        if (!texture.image) {
          blockingIssues.push(
            `${object.name || "mesh"}[${index}]: ${key} texture has no image data`,
          );
        }
      }
    });
  });

  if (pbrMaterialCount === 0) {
    blockingIssues.push("No PBR materials were found in the model.");
  }
  if (textureCount === 0) {
    issues.push("No PBR texture maps were found in the model.");
  }

  return { issues, blockingIssues };
}

function normalizeModel(root: THREE.Object3D): void {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const height = size.y > 0 ? size.y : 1.8;
  const scale = 1.8 / height;

  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);
}

async function prepareModel(asset: FashionModelAsset): Promise<PreparedModel> {
  const [{ GLTFLoader }, skeletonUtils, { MeshoptDecoder }] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/utils/SkeletonUtils.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(asset.path);
  const root = skeletonUtils.clone(gltf.scene) as THREE.Group;

  root.rotation.y = asset.facingYaw;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = materialsOf(object).map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      const clone = material.clone();
      clone.emissive = clone.emissive.clone();
      return clone;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0]!;
  });

  const validation = validateMaterials(root);
  normalizeModel(root);

  return { scene: root, issues: validation.issues, blockingIssues: validation.blockingIssues };
}

function loadModel(asset: FashionModelAsset): Promise<PreparedModel> {
  const cached = modelCache.get(asset.path);
  if (cached) return cached;
  const request = prepareModel(asset).catch((error: unknown) => {
    modelCache.delete(asset.path);
    throw error;
  });
  modelCache.set(asset.path, request);
  return request;
}

export function useFashionModels(selectedId: FashionModelId): FashionModelState {
  const asset = useMemo(() => getFashionModelAsset(selectedId), [selectedId]);
  const [status, setStatus] = useState<FashionModelStatus>("checking");
  const [model, setModel] = useState<PreparedModel | null>(null);
  const [license, setLicense] = useState<FashionLicenseRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [licenseIssues, setLicenseIssues] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);
  const [missingAssets, setMissingAssets] = useState<string[]>([]);
  const activeRequest = useRef(0);

  useEffect(() => {
    const requestId = activeRequest.current + 1;
    activeRequest.current = requestId;
    setModel(null);
    setLicense(null);
    setError(null);
    setLicenseIssues([]);
    setAvailableAssets([]);
    setMissingAssets([]);
    setStatus("checking");

    let cancelled = false;

    void (async () => {
      try {
        const [licenseRecords, availability] = await Promise.all([
          loadLicenseRecords(),
          Promise.all(
            FASHION_MODEL_ASSETS.map(async (candidate) => ({
              path: candidate.path,
              exists: await probeAsset(candidate.path),
            })),
          ),
        ]);
        if (cancelled || requestId !== activeRequest.current) return;

        const checks = FASHION_MODEL_ASSETS.map((candidate) => ({
          asset: candidate,
          ...verifyAssetLicense(candidate, licenseRecords),
        }));
        const issues = checks.flatMap((check) => (check.issue ? [check.issue] : []));
        const selectedCheck = checks.find((check) => check.asset.id === asset.id);

        setLicenseIssues(issues);
        setLicense(selectedCheck?.record ?? null);
        setAvailableAssets(
          availability.filter((item) => item.exists).map((item) => item.path),
        );
        setMissingAssets(
          availability.filter((item) => !item.exists).map((item) => item.path),
        );

        if (!selectedCheck?.record) {
          setStatus("license-unverified");
          return;
        }
        if (!availability.find((item) => item.path === asset.path)?.exists) {
          setStatus("missing");
          return;
        }

        setStatus("loading");
        const prepared = await loadModel(asset);
        if (cancelled || requestId !== activeRequest.current) return;

        if (prepared.blockingIssues.length > 0) {
          setError(prepared.blockingIssues.join(" "));
          setStatus("error");
          return;
        }

        setModel(prepared);
        setStatus("ready");
      } catch (loadError) {
        if (cancelled || requestId !== activeRequest.current) return;
        setError(loadError instanceof Error ? loadError.message : "The model could not be loaded.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asset]);

  return {
    status,
    asset,
    scene: model?.scene ?? null,
    license,
    issues: model?.issues ?? [],
    blockingIssues: model?.blockingIssues ?? [],
    licenseIssues,
    availableAssets,
    missingAssets,
    error,
  };
}
