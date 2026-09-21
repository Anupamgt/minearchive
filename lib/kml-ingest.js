/**
 * KMZ/KML ingest guards: size, zip-bomb, and path-traversal limits.
 * Rejects oversize input before JSZip/full DOM parse when possible.
 */

import { inflateRawSync } from 'node:zlib';

export class KmlIngestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'KmlIngestError';
    this.status = status;
  }
}

export const KML_LIMITS = {
  /** Compressed upload cap, applied before unzip. */
  MAX_UPLOAD_BYTES: 20 * 1024 * 1024,
  MAX_ZIP_ENTRIES: 32,
  MAX_ZIP_UNCOMPRESSED_BYTES: 25 * 1024 * 1024,
  MAX_KML_TEXT_BYTES: 8 * 1024 * 1024,
  MAX_FEATURES: 8000,
};

export const KML_EXPORT_LIMITS = {
  MAX_UPLOAD_IDS: 50,
  MAX_FEATURES: 8000,
  MAX_KML_BYTES: 12 * 1024 * 1024,
};

function mbLabel(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

function mergeLimits(overrides) {
  return { ...KML_LIMITS, ...(overrides || {}) };
}

export function assertUploadByteLength(byteLength, limits = KML_LIMITS) {
  const max = limits.MAX_UPLOAD_BYTES;
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    throw new KmlIngestError('Invalid upload');
  }
  if (byteLength > max) {
    throw new KmlIngestError(`File is too large. Maximum upload size is ${mbLabel(max)} MB.`);
  }
}

export function assertKmlTextLength(text, limits = KML_LIMITS) {
  const bytes = Buffer.byteLength(text || '', 'utf8');
  if (bytes > limits.MAX_KML_TEXT_BYTES) {
    throw new KmlIngestError(
      `KML is too large. Maximum uncompressed KML size is ${mbLabel(limits.MAX_KML_TEXT_BYTES)} MB.`
    );
  }
}

export function assertFeatureCount(count, limits = KML_LIMITS) {
  if (count > limits.MAX_FEATURES) {
    throw new KmlIngestError(
      `KML has too many features (${count}). Maximum is ${limits.MAX_FEATURES}.`
    );
  }
}

export function countPlacemarks(text) {
  if (typeof text !== 'string' || !text) return 0;
  return (text.match(/<Placemark\b/gi) || []).length;
}

function isZipBuffer(buffer) {
  return (
    buffer.length > 3 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function findEocdOffset(buffer) {
  const min = Math.max(0, buffer.length - 22 - 65535);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return -1;
}

export function assertSafeZipEntryName(name) {
  if (typeof name !== 'string' || !name || name.length > 255) {
    throw new KmlIngestError('KMZ contains an invalid file path.');
  }
  if (/[\u0000-\u001F\u007F]/.test(name)) {
    throw new KmlIngestError('KMZ contains an invalid file path.');
  }
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new KmlIngestError('KMZ contains an unsafe file path.');
  }
  const parts = normalized.split('/');
  if (parts.some((part) => part === '..' || part === '.')) {
    throw new KmlIngestError('KMZ contains a nested or path-traversal entry.');
  }
  if (/\.(zip|kmz)$/i.test(normalized) && !normalized.endsWith('/')) {
    throw new KmlIngestError('Nested KMZ/ZIP archives are not allowed.');
  }
}

/**
 * Read the ZIP central directory without decompressing entries.
 * Rejects zip64, oversize entry counts, path traversal, and nested archives.
 */
export function inspectKmzCentralDirectory(buffer, limits = KML_LIMITS) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw new KmlIngestError('Invalid KMZ archive.');
  }
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const eocd = findEocdOffset(buf);
  if (eocd < 0) {
    throw new KmlIngestError('Invalid KMZ archive.');
  }

  const entriesOnDisk = buf.readUInt16LE(eocd + 8);
  const entryCount = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  if (
    entriesOnDisk === 0xffff ||
    entryCount === 0xffff ||
    cdSize === 0xffffffff ||
    cdOffset === 0xffffffff
  ) {
    throw new KmlIngestError('Zip64 KMZ archives are not supported.');
  }
  if (entryCount === 0) {
    throw new KmlIngestError('KMZ archive contains no files.');
  }
  if (entryCount > limits.MAX_ZIP_ENTRIES) {
    throw new KmlIngestError(
      `KMZ has too many entries (${entryCount}). Maximum is ${limits.MAX_ZIP_ENTRIES}.`
    );
  }
  if (cdOffset + cdSize > buf.length) {
    throw new KmlIngestError('Invalid KMZ archive.');
  }

  const entries = [];
  let pos = cdOffset;
  let totalUncompressed = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (pos + 46 > buf.length) {
      throw new KmlIngestError('Invalid KMZ archive.');
    }
    if (buf.readUInt32LE(pos) !== 0x02014b50) {
      throw new KmlIngestError('Invalid KMZ archive.');
    }
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);

    assertSafeZipEntryName(name);

    if (flags & 0x0001) {
      throw new KmlIngestError('Encrypted KMZ archives are not supported.');
    }
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new KmlIngestError('Zip64 KMZ archives are not supported.');
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new KmlIngestError(
        `KMZ uncompressed size exceeds the ${mbLabel(limits.MAX_ZIP_UNCOMPRESSED_BYTES)} MB limit.`
      );
    }

    entries.push({
      name,
      method,
      flags,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return { entryCount, entries, totalUncompressed };
}

function inflateZipEntry(buffer, entry, maxOutputLength) {
  if (entry.localOffset + 30 > buffer.length) {
    throw new KmlIngestError('Invalid KMZ archive.');
  }
  if (buffer.readUInt32LE(entry.localOffset) !== 0x04034b50) {
    throw new KmlIngestError('Invalid KMZ archive.');
  }
  const localNameLen = buffer.readUInt16LE(entry.localOffset + 26);
  const localExtraLen = buffer.readUInt16LE(entry.localOffset + 28);
  const dataStart = entry.localOffset + 30 + localNameLen + localExtraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) {
    throw new KmlIngestError('Invalid KMZ archive.');
  }
  const data = buffer.subarray(dataStart, dataEnd);

  if (entry.uncompressedSize > maxOutputLength) {
    throw new KmlIngestError(
      `KML is too large. Maximum uncompressed KML size is ${mbLabel(maxOutputLength)} MB.`
    );
  }

  if (entry.method === 0) {
    if (data.length > maxOutputLength) {
      throw new KmlIngestError(
        `KML is too large. Maximum uncompressed KML size is ${mbLabel(maxOutputLength)} MB.`
      );
    }
    return data.toString('utf8');
  }
  if (entry.method !== 8) {
    throw new KmlIngestError('KMZ uses an unsupported compression method.');
  }
  try {
    return inflateRawSync(data, { maxOutputLength }).toString('utf8');
  } catch {
    throw new KmlIngestError('KMZ KML document is too large or corrupt.');
  }
}

function chooseKmlEntry(entries) {
  const kmlEntries = entries.filter((entry) => /\.kml$/i.test(entry.name) && !entry.name.endsWith('/'));
  if (kmlEntries.length === 0) {
    throw new KmlIngestError('KMZ archive contains no .kml document.');
  }
  return kmlEntries.find((entry) => /(^|\/)doc\.kml$/i.test(entry.name)) || kmlEntries[0];
}

async function fileToBuffer(file, limits) {
  if (Buffer.isBuffer(file)) return file;
  if (file instanceof Uint8Array) return Buffer.from(file);
  if (typeof file?.size === 'number') {
    assertUploadByteLength(file.size, limits);
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new KmlIngestError('No KML file provided.');
  }
  return Buffer.from(await file.arrayBuffer());
}

/**
 * Read KML text from a .kml upload or a .kmz ZIP, with DoS limits.
 * @param {{ name?: string, size?: number, arrayBuffer: () => Promise<ArrayBuffer> } | Buffer} file
 */
export async function extractKmlText(file, limitOverrides) {
  const limits = mergeLimits(limitOverrides);
  const buffer = await fileToBuffer(file, limits);
  assertUploadByteLength(buffer.length, limits);

  const fileName = typeof file?.name === 'string' ? file.name : '';
  const looksKmz = /\.kmz$/i.test(fileName) || isZipBuffer(buffer);

  if (!looksKmz) {
    if (buffer.length > limits.MAX_KML_TEXT_BYTES) {
      throw new KmlIngestError(
        `KML is too large. Maximum uncompressed KML size is ${mbLabel(limits.MAX_KML_TEXT_BYTES)} MB.`
      );
    }
    return buffer.toString('utf8');
  }

  const { entries } = inspectKmzCentralDirectory(buffer, limits);
  const chosen = chooseKmlEntry(entries);
  const text = inflateZipEntry(buffer, chosen, limits.MAX_KML_TEXT_BYTES);
  assertKmlTextLength(text, limits);
  return text;
}
