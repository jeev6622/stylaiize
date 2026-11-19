import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelDir = join(webRoot, "public", "models");
const licenseFile = join(modelDir, "LICENSES.txt");
const licensePublicPath = "/models/LICENSES.txt";
const acceptedLicenses = new Set(["CC0-1.0", "CC-BY-4.0"]);
const licenseFormat = "filename | license identifier | model name | copyright holder | source URL";

const models = [
  "female-fashion-model.glb",
  "male-fashion-model.glb",
].map((fileName) => ({
  fileName,
  label: fileName,
  file: join(modelDir, fileName),
  publicPath: `/models/${fileName}`,
}));

const failures = [];
const warnings = [];

function normalizeLicenseId(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

function resolveUri(modelFile, uri) {
  if (uri.startsWith("data:")) return null;
  if (uri.startsWith("/")) return join(webRoot, "public", uri);
  return resolve(dirname(modelFile), uri);
}

function verifyGLB(model) {
  if (!existsSync(model.file)) {
    failures.push(`${model.publicPath}: missing GLB file`);
    return;
  }

  const buffer = readFileSync(model.file);
  if (buffer.byteLength < 1024 * 100) {
    failures.push(`${model.publicPath}: file is too small to be a detailed human model`);
    return;
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.byteLength < 20) {
    failures.push(`${model.publicPath}: file is too small to be a GLB`);
    return;
  }
  if (view.getUint32(0, true) !== 0x46546c67) {
    failures.push(`${model.publicPath}: invalid GLB header`);
    return;
  }
  if (view.getUint32(4, true) !== 2) {
    failures.push(`${model.publicPath}: unsupported glTF version`);
    return;
  }
  if (view.getUint32(8, true) !== buffer.byteLength) {
    failures.push(`${model.publicPath}: declared GLB length does not match file size`);
    return;
  }

  let offset = 12;
  let json = null;
  let binaryLength = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkStart + chunkLength > buffer.byteLength) {
      failures.push(`${model.publicPath}: truncated GLB chunk`);
      return;
    }
    if (chunkType === 0x4e4f534a) {
      try {
        json = JSON.parse(buffer.subarray(chunkStart, chunkStart + chunkLength).toString("utf8"));
      } catch {
        failures.push(`${model.publicPath}: invalid JSON chunk`);
        return;
      }
    }
    if (chunkType === 0x004e4942) binaryLength = chunkLength;
    offset = chunkStart + chunkLength;
  }

  if (!json || json.asset?.version !== "2.0") {
    failures.push(`${model.publicPath}: missing or invalid glTF 2.0 JSON`);
    return;
  }

  const requiredExtensions = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  if (requiredExtensions.includes("KHR_draco_mesh_compression")) {
    failures.push(`${model.publicPath}: DRACO compression requires a decoder to be configured`);
  }
  if (requiredExtensions.includes("KHR_texture_basisu")) {
    failures.push(`${model.publicPath}: KTX2 textures require a transcoder to be configured`);
  }

  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  if (meshes.length === 0) {
    failures.push(`${model.publicPath}: no meshes were found`);
  }

  const materials = Array.isArray(json.materials) ? json.materials : [];
  if (materials.length === 0) {
    failures.push(`${model.publicPath}: no materials were found`);
  }
  const pbrMaterials = materials.filter(
    (material) => material.pbrMetallicRoughness || material.extensions?.KHR_materials_pbrSpecularGlossiness,
  );
  if (materials.length > 0 && pbrMaterials.length === 0) {
    failures.push(`${model.publicPath}: no PBR materials were found`);
  }

  const images = Array.isArray(json.images) ? json.images : [];
  if (images.length === 0) {
    failures.push(`${model.publicPath}: no embedded or external textures were declared`);
  }

  images.forEach((image, index) => {
    if (typeof image.uri === "string") {
      const texturePath = resolveUri(model.file, image.uri);
      if (texturePath && !existsSync(texturePath)) {
        failures.push(`${model.publicPath}: missing texture ${image.uri}`);
      }
      return;
    }
    if (typeof image.bufferView === "number") {
      const bufferViews = Array.isArray(json.bufferViews) ? json.bufferViews : [];
      const viewEntry = bufferViews[image.bufferView];
      if (!viewEntry || typeof viewEntry.byteOffset !== "number" || typeof viewEntry.byteLength !== "number") {
        failures.push(`${model.publicPath}: invalid image bufferView at images[${index}]`);
      } else if (viewEntry.byteOffset + viewEntry.byteLength > binaryLength) {
        failures.push(`${model.publicPath}: embedded image exceeds binary chunk`);
      }
      return;
    }
    failures.push(`${model.publicPath}: image ${index} has no uri or bufferView`);
  });

  const buffers = Array.isArray(json.buffers) ? json.buffers : [];
  buffers.forEach((entry, index) => {
    if (typeof entry.uri !== "string") return;
    const bufferPath = resolveUri(model.file, entry.uri);
    if (bufferPath && !existsSync(bufferPath)) {
      failures.push(`${model.publicPath}: missing buffer ${entry.uri} at buffers[${index}]`);
    }
  });
}

function parseLicenseRecords(contents) {
  const records = new Map();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [fileName, identifier, name, holder, source] = line
      .split("|")
      .map((part) => part.trim());
    if (!fileName || !identifier || !name || !holder || !source) continue;
    if (!/^https?:\/\//i.test(source)) continue;
    records.set(fileName, { identifier, name, holder, source });
  }
  return records;
}

function verifyLicense() {
  if (!existsSync(licenseFile)) {
    failures.push(`${licensePublicPath}: missing licence record`);
    return;
  }

  const records = parseLicenseRecords(readFileSync(licenseFile, "utf8"));
  if (records.size === 0) {
    failures.push(`${licensePublicPath}: no valid entries using: ${licenseFormat}`);
  }

  for (const model of models) {
    const record = records.get(model.fileName);
    if (!record) {
      failures.push(`${licensePublicPath}: missing licence entry for ${model.fileName}`);
      continue;
    }
    if (!acceptedLicenses.has(normalizeLicenseId(record.identifier))) {
      failures.push(
        `${licensePublicPath}: unsupported licence '${record.identifier}' for ${model.fileName}`,
      );
    }
  }
}

models.forEach(verifyGLB);
verifyLicense();

if (warnings.length > 0) {
  for (const warning of warnings) process.stdout.write(`WARN ${warning}\n`);
}
if (failures.length > 0) {
  for (const failure of failures) process.stdout.write(`FAIL ${failure}\n`);
  process.exitCode = 1;
} else {
  for (const model of models) process.stdout.write(`PASS ${model.publicPath}\n`);
  process.stdout.write(`PASS ${licensePublicPath}\n`);
}
