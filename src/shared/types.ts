export const defaultAnnotationCaptureIpcChannel = "electron-live-annotations:capture-element";

export const annotationSchemaVersion = 1;

export const defaultAnnotationVerdicts = [
  "note",
  "approved",
  "confusing",
  "bug",
  "copy",
  "design",
  "blocked",
  "needs-product-decision",
] as const;

export type DefaultAnnotationVerdict = (typeof defaultAnnotationVerdicts)[number];

export type AnnotationRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnnotationViewport = {
  width: number;
  height: number;
  deviceScaleFactor: number;
};

export type AnnotationElementIdentity = {
  xpath: string;
  cssSelector: string;
  stableSelector: string | null;
  testId: string | null;
  dataAttributes: Record<string, string>;
  nearestStableAncestor: string | null;
  role: string | null;
  accessibleName: string | null;
  tagName: string;
  textSnippet: string | null;
};

export type AnnotationRouteSnapshot = {
  href: string;
  hash: string;
  pathname: string;
  search: string;
  title: string;
};

export type AnnotationCaptureRequest<
  TVerdict extends string = DefaultAnnotationVerdict,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = {
  annotationId: string;
  sessionId: string;
  capturedAt: string;
  route: AnnotationRouteSnapshot;
  rect: AnnotationRect;
  viewport: AnnotationViewport;
  element: AnnotationElementIdentity;
  verdict: TVerdict;
  note: string;
  includeViewportImage?: boolean;
  metadata?: TMetadata;
};

export type AnnotationManifestRow<
  TVerdict extends string = DefaultAnnotationVerdict,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = AnnotationCaptureRequest<TVerdict, TMetadata> & {
  schemaVersion: typeof annotationSchemaVersion;
  elementImagePath: string;
  elementImageRelativePath: string;
  manifestJsonPath: string;
  manifestJsonlPath: string;
  viewportImagePath: string | null;
  viewportImageRelativePath: string | null;
};

export type AnnotationCaptureResult<
  TVerdict extends string = DefaultAnnotationVerdict,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = {
  manifest: AnnotationManifestRow<TVerdict, TMetadata>;
};

export type AnnotationPreloadApi<
  TVerdict extends string = DefaultAnnotationVerdict,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = {
  captureElement(
    request: AnnotationCaptureRequest<TVerdict, TMetadata>,
  ): Promise<AnnotationCaptureResult<TVerdict, TMetadata>>;
};
