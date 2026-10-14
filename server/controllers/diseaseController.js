import multer from 'multer';
import { detectDisease } from '../services/diseaseDetectionService.js';
import Disease from '../models/Disease.js';

const configuredUploadMb = Number(process.env.MAX_UPLOAD_MB);
const MAX_UPLOAD_BYTES = (Number.isFinite(configuredUploadMb) && configuredUploadMb > 0 ? Math.min(configuredUploadMb, 5) : 5) * 1024 * 1024;
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, parts: 6, fieldNameSize: 100, fieldSize: 1024 },
  fileFilter: (_req, file, callback) => {
    if (!acceptedTypes.has(file.mimetype)) {
      const error = new Error('Use a JPEG, PNG, or WebP image.');
      error.status = 415;
      return callback(error);
    }
    return callback(null, true);
  },
});

export function imageUpload(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (error) {
      if (error.name === 'MulterError' || error.status === 415) return next(error);
      return next(Object.assign(new Error('Malformed multipart image upload.'), { status: 400 }));
    }
    return next();
  });
}

export async function detect(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a crop image to upload.' });
    const format = getImageFormat(req.file.buffer);
    if (!format || format.mimeType !== req.file.mimetype) {
      return res.status(415).json({ message: 'The image contents do not match a supported JPEG, PNG, or WebP file.' });
    }

    const result = await detectDisease(req.file.buffer, { mimeType: format.mimeType });
    return res.json({ result, disclaimer: 'This is a model-generated possibility, not a confirmed diagnosis. Consult a local agricultural expert before acting.' });
  } catch (error) {
    return next(error);
  } finally {
    // The image is transient and never written to disk or the database.
    req.file?.buffer?.fill(0);
    req.file = undefined;
  }
}

export async function listDiseases(_req, res, next) {
  try { return res.json({ diseases: await Disease.find().sort({ name: 1 }) }); }
  catch (error) { return next(error); }
}

export async function getDisease(req, res, next) {
  try {
    const disease = await Disease.findById(req.params.id);
    if (!disease) return res.status(404).json({ message: 'Disease information not found.' });
    return res.json({ disease });
  } catch (error) { return next(error); }
}

function getImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (isJpeg(buffer)) {
    return { mimeType: 'image/jpeg' };
  }
  if (isPng(buffer)) {
    return { mimeType: 'image/png' };
  }
  if (isWebp(buffer)) {
    return { mimeType: 'image/webp' };
  }
  return null;
}

function isJpeg(buffer) {
  if (buffer.length < 16 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) return false;
  let offset = 2;
  let hasFrame = false;
  while (offset < buffer.length - 2) {
    if (buffer[offset++] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xda) {
      if (offset + 2 > buffer.length - 2) return false;
      const scanHeaderLength = buffer.readUInt16BE(offset);
      return hasFrame && scanHeaderLength >= 6 && offset + scanHeaderLength + 1 <= buffer.length - 2;
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x00) return false;
    if (offset + 2 > buffer.length) return false;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length - 2) return false;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (segmentLength < 8) return false;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (!width || !height || width * height > 40_000_000) return false;
      hasFrame = true;
    }
    offset += segmentLength;
  }
  return false;
}

function isPng(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 57 || !buffer.subarray(0, 8).equals(signature)) return false;
  let offset = 8;
  let hasHeader = false;
  let hasImageData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    if (!hasHeader) {
      if (type !== 'IHDR' || length !== 13) return false;
      const width = buffer.readUInt32BE(offset + 8);
      const height = buffer.readUInt32BE(offset + 12);
      if (!width || !height || width * height > 40_000_000) return false;
      hasHeader = true;
    } else if (type === 'IHDR') return false;
    if (type === 'IDAT' && length > 0) hasImageData = true;
    if (type === 'IEND') return length === 0 && hasHeader && hasImageData && end === buffer.length;
    offset = end;
  }
  return false;
}

function isWebp(buffer) {
  if (buffer.length < 25 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP' || buffer.readUInt32LE(4) + 8 !== buffer.length) return false;
  let offset = 12;
  let hasImage = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > buffer.length) return false;
    if (['VP8 ', 'VP8L', 'VP8X'].includes(type)) {
      const dimensions = getWebpDimensions(buffer, type, offset + 8, length);
      if (!dimensions || !dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 40_000_000) return false;
      hasImage = true;
    }
    offset = end;
  }
  return hasImage && offset === buffer.length;
}

function getWebpDimensions(buffer, type, payloadOffset, length) {
  if (type === 'VP8X' && length >= 10) {
    return {
      width: buffer.readUIntLE(payloadOffset + 4, 3) + 1,
      height: buffer.readUIntLE(payloadOffset + 7, 3) + 1,
    };
  }
  if (type === 'VP8L' && length >= 5 && buffer[payloadOffset] === 0x2f) {
    const dimensionBits = buffer.readUInt32LE(payloadOffset + 1);
    return { width: (dimensionBits & 0x3fff) + 1, height: ((dimensionBits >>> 14) & 0x3fff) + 1 };
  }
  if (type === 'VP8 ' && length >= 10 && buffer[payloadOffset + 3] === 0x9d && buffer[payloadOffset + 4] === 0x01 && buffer[payloadOffset + 5] === 0x2a) {
    return { width: buffer.readUInt16LE(payloadOffset + 6) & 0x3fff, height: buffer.readUInt16LE(payloadOffset + 8) & 0x3fff };
  }
  return null;
}
