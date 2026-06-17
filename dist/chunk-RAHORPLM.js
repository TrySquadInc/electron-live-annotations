import {
  annotationSchemaVersion,
  defaultAnnotationVerdicts
} from "./chunk-NE5CIZFX.js";

// src/main/persistence.ts
import { appendFile, mkdir, writeFile } from "fs/promises";
import { join } from "path";
var maxSegmentLength = 96;
var pngSignature = "89504e470d0a1a0a";
function sanitizeAnnotationPathSegment(input, fallback) {
  const normalized = input.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "").slice(0, maxSegmentLength);
  if (!normalized || normalized === "." || normalized === "..") {
    return fallback;
  }
  return normalized;
}
function annotationSessionDir(userDataPath, sessionId) {
  return join(userDataPath, "annotations", sanitizeAnnotationPathSegment(sessionId, "session"));
}
function annotationImageRelativePath(annotationId, kind) {
  return join("images", `${sanitizeAnnotationPathSegment(annotationId, "annotation")}-${kind}.png`);
}
function clampAnnotationCaptureRect(rect, viewport) {
  const viewportWidth = Math.max(1, Math.floor(viewport.width));
  const viewportHeight = Math.max(1, Math.floor(viewport.height));
  const rawX = Number.isFinite(rect.x) ? rect.x : 0;
  const rawY = Number.isFinite(rect.y) ? rect.y : 0;
  const rawWidth = Number.isFinite(rect.width) ? rect.width : 1;
  const rawHeight = Number.isFinite(rect.height) ? rect.height : 1;
  const x = Math.max(0, Math.min(Math.floor(rawX), viewportWidth - 1));
  const y = Math.max(0, Math.min(Math.floor(rawY), viewportHeight - 1));
  const width = Math.max(1, Math.min(Math.ceil(rawWidth), viewportWidth - x));
  const height = Math.max(1, Math.min(Math.ceil(rawHeight), viewportHeight - y));
  return { height, width, x, y };
}
function scaleAnnotationCaptureRectToImage(rect, viewport, image) {
  const imageWidth = Math.max(1, Math.floor(image.width));
  const imageHeight = Math.max(1, Math.floor(image.height));
  const viewportWidth = Math.max(1, viewport.width);
  const viewportHeight = Math.max(1, viewport.height);
  const scaleX = imageWidth / viewportWidth;
  const scaleY = imageHeight / viewportHeight;
  const x = Math.max(0, Math.min(Math.floor(rect.x * scaleX), imageWidth - 1));
  const y = Math.max(0, Math.min(Math.floor(rect.y * scaleY), imageHeight - 1));
  const width = Math.max(1, Math.min(Math.ceil(rect.width * scaleX), imageWidth - x));
  const height = Math.max(1, Math.min(Math.ceil(rect.height * scaleY), imageHeight - y));
  return { height, width, x, y };
}
function annotationCaptureRectsForImage(request, image) {
  const rect = clampAnnotationCaptureRect(request.rect, request.viewport);
  const imageRect = scaleAnnotationCaptureRectToImage(rect, request.viewport, image);
  return { imageRect, rect };
}
function pngDimensionsFromBuffer(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Annotation viewport capture did not produce a valid PNG.");
  }
  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16)
  };
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeAnnotationCaptureRequest(input, verdicts = defaultAnnotationVerdicts) {
  if (typeof input !== "object" || input === null) {
    throw new Error("Annotation capture request must be an object.");
  }
  const request = input;
  if (!isNonEmptyString(request.sessionId) || !isNonEmptyString(request.annotationId)) {
    throw new Error(
      "Annotation capture request requires non-empty string sessionId and annotationId."
    );
  }
  if (!isPlainObject(request.route) || !isPlainObject(request.element) || !isPlainObject(request.rect) || !isPlainObject(request.viewport)) {
    throw new Error("Annotation capture request is missing route, rect, viewport, or element.");
  }
  if (request.note !== void 0 && typeof request.note !== "string") {
    throw new Error("Annotation capture request note must be a string.");
  }
  if (!verdicts.includes(request.verdict)) {
    throw new Error(`Unsupported annotation verdict: ${String(request.verdict)}`);
  }
  return {
    ...request,
    capturedAt: request.capturedAt || (/* @__PURE__ */ new Date()).toISOString(),
    note: request.note ?? ""
  };
}
async function persistAnnotationCapture({
  elementImage,
  request,
  userDataPath,
  viewportImage = null
}) {
  const sessionDir = annotationSessionDir(userDataPath, request.sessionId);
  const imagesDir = join(sessionDir, "images");
  const elementImageRelativePath = annotationImageRelativePath(request.annotationId, "element");
  const viewportImageRelativePath = viewportImage ? annotationImageRelativePath(request.annotationId, "viewport") : null;
  const elementImagePath = join(sessionDir, elementImageRelativePath);
  const viewportImagePath = viewportImageRelativePath ? join(sessionDir, viewportImageRelativePath) : null;
  const manifestJsonlPath = join(sessionDir, "manifest.jsonl");
  const manifestJsonPath = join(sessionDir, "manifest.json");
  await mkdir(imagesDir, { recursive: true });
  await writeFile(elementImagePath, elementImage);
  if (viewportImage && viewportImagePath) {
    await writeFile(viewportImagePath, viewportImage);
  }
  const manifest = {
    ...request,
    elementImagePath,
    elementImageRelativePath,
    manifestJsonPath,
    manifestJsonlPath,
    schemaVersion: annotationSchemaVersion,
    viewportImagePath,
    viewportImageRelativePath
  };
  await appendFile(manifestJsonlPath, `${JSON.stringify(manifest)}
`);
  await writeFile(
    manifestJsonPath,
    `${JSON.stringify(
      {
        manifestJsonlPath,
        schemaVersion: annotationSchemaVersion,
        sessionId: request.sessionId,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      null,
      2
    )}
`
  );
  return manifest;
}

export {
  sanitizeAnnotationPathSegment,
  annotationSessionDir,
  annotationImageRelativePath,
  clampAnnotationCaptureRect,
  scaleAnnotationCaptureRectToImage,
  annotationCaptureRectsForImage,
  pngDimensionsFromBuffer,
  normalizeAnnotationCaptureRequest,
  persistAnnotationCapture
};
