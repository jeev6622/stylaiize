import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { LocalStorage } from "./local.storage";

/**
 * `LocalStorage.delete` guarded against path traversal with
 * `absolute.startsWith(UPLOAD_ROOT)`, which a sibling directory whose name
 * merely starts with "uploads" satisfies. `uploads-backup/secret.txt` resolved
 * to `<cwd>/uploads-backup/secret.txt`, passed the prefix check, and was
 * deleted. The fix compares against the root plus a path separator.
 */

const storage = new LocalStorage();
const ROOT = path.resolve(process.cwd(), "uploads");
const SIBLING = path.resolve(process.cwd(), "uploads-backup");
const SIBLING_FILE = path.join(SIBLING, "secret.txt");

beforeAll(async () => {
  await mkdir(SIBLING, { recursive: true });
  await writeFile(SIBLING_FILE, "do not delete me", "utf8");
});

afterAll(async () => {
  await rm(SIBLING, { recursive: true, force: true });
});

describe("LocalStorage.delete path traversal guard", () => {
  it("refuses to delete a file in a sibling directory that shares the root prefix", async () => {
    await storage.delete("stylaiize/../uploads-backup/secret.txt");
    expect(existsSync(SIBLING_FILE)).toBe(true);
  });

  it("refuses a traversal that escapes the upload root entirely", async () => {
    await storage.delete("stylaiize/../../package.json");
    expect(existsSync(path.resolve(process.cwd(), "package.json"))).toBe(true);
  });

  it("refuses to delete the upload root itself", async () => {
    await storage.delete("stylaiize/..");
    expect(existsSync(ROOT)).toBe(true);
  });

  it("deletes a file that genuinely lives inside the upload root", async () => {
    const { publicId } = await storage.upload({
      buffer: Buffer.from("placeholder"),
      filename: "photo.png",
      mimeType: "image/png",
      folder: "guard-test",
    });
    const target = path.join(ROOT, "guard-test", path.basename(publicId));
    expect(existsSync(target)).toBe(true);

    await storage.delete(publicId);
    expect(existsSync(target)).toBe(false);
  });
});
