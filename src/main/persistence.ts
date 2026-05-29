import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AnnotationCaptureRequest,
  type AnnotationManifestRow,
  type AnnotationRect,
  type AnnotationViewport,
  annotationSchemaVersion,
  defaultAnnotationVerdicts,
} from "../shared/types.js";

export type PersistAnnotationCaptureInput<
  TVerdict extends string = string,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = {
  elementImage: Buffer;
  request: AnnotationCaptureRequest<TVerdict, TMetadata>;
  userDataPath: string;
  viewportImage?: Buffer | null;
};

const maxSegmentLength = 96;
const pngSignature = "89504e470d0a1a0a";

export function sanitizeAnnotationPathSegment(input: string, fallback: string) {
  const normalized = input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, maxSegmentLength);

  if (!normalized || normalized === "." || normalized === "..") {
    return fallback;
  }

  return normalized;
}

export function annotationSessionDir(userDataPath: string, sessionId: string) {
  return join(userDataPath, "annotations", sanitizeAnnotationPathSegment(sessionId, "session"));
}

export function annotationImageRelativePath(annotationId: string, kind: "element" | "viewport") {
  return join("images", `${sanitizeAnnotationPathSegment(annotationId, "annotation")}-${kind}.png`);
}

export function clampAnnotationCaptureRect(
  rect: AnnotationRect,
  viewport: Pick<AnnotationViewport, "height" | "width">,
): AnnotationRect {
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

export function scaleAnnotationCaptureRectToImage(
  rect: AnnotationRect,
  viewport: Pick<AnnotationViewport, "height" | "width">,
  image: Pick<AnnotationViewport, "height" | "width">,
): AnnotationRect {
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

export function annotationCaptureRectsForImage(
  request: AnnotationCaptureRequest<string>,
  image: Pick<AnnotationViewport, "height" | "width">,
) {
  const rect = clampAnnotationCaptureRect(request.rect, request.viewport);
  const imageRect = scaleAnnotationCaptureRectToImage(rect, request.viewport, image);
  return { imageRect, rect };
}

export function pngDimensionsFromBuffer(
  buffer: Buffer,
): Pick<AnnotationViewport, "height" | "width"> {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Annotation viewport capture did not produce a valid PNG.");
  }

  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

export function normalizeAnnotationCaptureRequest<TVerdict extends string = string>(
  input: unknown,
  verdicts: readonly TVerdict[] = defaultAnnotationVerdicts as unknown as readonly TVerdict[],
): AnnotationCaptureRequest<TVerdict> {
  if (typeof input !== "object" || input === null) {
    throw new Error("Annotation capture request must be an object.");
  }

  const request = input as Partial<AnnotationCaptureRequest<TVerdict>>;
  if (!request.sessionId || !request.annotationId) {
    throw new Error("Annotation capture request requires sessionId and annotationId.");
  }
  if (!request.route || !request.rect || !request.viewport || !request.element) {
    throw new Error("Annotation capture request is missing route, rect, viewport, or element.");
  }
  if (!verdicts.includes(request.verdict as TVerdict)) {
    throw new Error(`Unsupported annotation verdict: ${String(request.verdict)}`);
  }

  return {
    ...(request as AnnotationCaptureRequest<TVerdict>),
    capturedAt: request.capturedAt || new Date().toISOString(),
    note: request.note ?? "",
  };
}

export async function persistAnnotationCapture<
  TVerdict extends string = string,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>({
  elementImage,
  request,
  userDataPath,
  viewportImage = null,
}: PersistAnnotationCaptureInput<TVerdict, TMetadata>) {
  const sessionDir = annotationSessionDir(userDataPath, request.sessionId);
  const imagesDir = join(sessionDir, "images");
  const elementImageRelativePath = annotationImageRelativePath(request.annotationId, "element");
  const viewportImageRelativePath = viewportImage
    ? annotationImageRelativePath(request.annotationId, "viewport")
    : null;
  const elementImagePath = join(sessionDir, elementImageRelativePath);
  const viewportImagePath = viewportImageRelativePath
    ? join(sessionDir, viewportImageRelativePath)
    : null;
  const manifestJsonlPath = join(sessionDir, "manifest.jsonl");
  const manifestJsonPath = join(sessionDir, "manifest.json");

  await mkdir(imagesDir, { recursive: true });
  await writeFile(elementImagePath, elementImage);
  if (viewportImage && viewportImagePath) {
    await writeFile(viewportImagePath, viewportImage);
  }

  const manifest: AnnotationManifestRow<TVerdict, TMetadata> = {
    ...request,
    elementImagePath,
    elementImageRelativePath,
    manifestJsonPath,
    manifestJsonlPath,
    schemaVersion: annotationSchemaVersion,
    viewportImagePath,
    viewportImageRelativePath,
  };

  await appendFile(manifestJsonlPath, `${JSON.stringify(manifest)}\n`);
  await writeFile(
    manifestJsonPath,
    `${JSON.stringify(
      {
        manifestJsonlPath,
        schemaVersion: annotationSchemaVersion,
        sessionId: request.sessionId,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  return manifest;
}
