import { AnnotationCaptureRequest, AnnotationViewport, AnnotationRect, AnnotationManifestRow } from '../shared/types.js';

type PersistAnnotationCaptureInput<TVerdict extends string = string, TMetadata extends Record<string, unknown> = Record<string, unknown>> = {
    elementImage: Buffer;
    request: AnnotationCaptureRequest<TVerdict, TMetadata>;
    userDataPath: string;
    viewportImage?: Buffer | null;
};
declare function sanitizeAnnotationPathSegment(input: string, fallback: string): string;
declare function annotationSessionDir(userDataPath: string, sessionId: string): string;
declare function annotationImageRelativePath(annotationId: string, kind: "element" | "viewport"): string;
declare function clampAnnotationCaptureRect(rect: AnnotationRect, viewport: Pick<AnnotationViewport, "height" | "width">): AnnotationRect;
declare function scaleAnnotationCaptureRectToImage(rect: AnnotationRect, viewport: Pick<AnnotationViewport, "height" | "width">, image: Pick<AnnotationViewport, "height" | "width">): AnnotationRect;
declare function annotationCaptureRectsForImage(request: AnnotationCaptureRequest<string>, image: Pick<AnnotationViewport, "height" | "width">): {
    imageRect: AnnotationRect;
    rect: AnnotationRect;
};
declare function pngDimensionsFromBuffer(buffer: Buffer): Pick<AnnotationViewport, "height" | "width">;
declare function normalizeAnnotationCaptureRequest<TVerdict extends string = string>(input: unknown, verdicts?: readonly TVerdict[]): AnnotationCaptureRequest<TVerdict>;
declare function persistAnnotationCapture<TVerdict extends string = string, TMetadata extends Record<string, unknown> = Record<string, unknown>>({ elementImage, request, userDataPath, viewportImage, }: PersistAnnotationCaptureInput<TVerdict, TMetadata>): Promise<AnnotationManifestRow<TVerdict, TMetadata>>;

export { type PersistAnnotationCaptureInput, annotationCaptureRectsForImage, annotationImageRelativePath, annotationSessionDir, clampAnnotationCaptureRect, normalizeAnnotationCaptureRequest, persistAnnotationCapture, pngDimensionsFromBuffer, sanitizeAnnotationPathSegment, scaleAnnotationCaptureRectToImage };
