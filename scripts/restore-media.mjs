import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, mkdir, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  await readFile(resolve(root, "media/source-footage/manifest.json"), "utf8"),
);
const target = resolve(root, manifest.file);

async function checksum(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

let existing;
try {
  existing = await stat(target);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

if (existing) {
  if (
    existing.size !== manifest.size ||
    (await checksum(target)) !== manifest.sha256
  ) {
    throw new Error(`Existing ${manifest.file} differs from the source. Move it aside before restoring.`);
  }
  console.log(`Source footage verified: ${manifest.file}`);
} else {
  const temporary = `${target}.restore-tmp-${process.pid}`;
  await mkdir(dirname(target), { recursive: true });
  const fullHash = createHash("sha256");
  let totalSize = 0;

  async function* chunks() {
    for (const part of manifest.parts) {
      const hash = createHash("sha256");
      let size = 0;
      for await (const chunk of createReadStream(resolve(root, part.file))) {
        hash.update(chunk);
        fullHash.update(chunk);
        size += chunk.length;
        totalSize += chunk.length;
        yield chunk;
      }
      if (size !== part.size || hash.digest("hex") !== part.sha256) {
        throw new Error(`Source footage part failed verification: ${part.file}`);
      }
    }
  }

  try {
    await pipeline(
      Readable.from(chunks()),
      createWriteStream(temporary, { flags: "wx" }),
    );
    if (totalSize !== manifest.size || fullHash.digest("hex") !== manifest.sha256) {
      throw new Error("Restored footage failed verification.");
    }
    // Linking fails atomically if another process has created the target.
    await link(temporary, target);
    await unlink(temporary);
    console.log(`Restored source footage: ${manifest.file}`);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
