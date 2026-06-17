declare const defaultAnnotationCaptureIpcChannel = "electron-live-annotations:capture-element";
declare const annotationSchemaVersion = 1;
type DefaultAnnotationVerdict = "note" | "approved" | "confusing" | "bug" | "copy" | "design" | "blocked" | "needs-product-decision";
declare const defaultAnnotationVerdicts: readonly DefaultAnnotationVerdict[];
type AnnotationRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
type AnnotationViewport = {
    width: number;
    height: number;
    deviceScaleFactor: number;
    scrollX?: number;
    scrollY?: number;
};
type AnnotationElementIdentity = {
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
type AnnotationRouteSnapshot = {
    href: string;
    hash: string;
    pathname: string;
    search: string;
    title: string;
};
type AnnotationCaptureRequest<TVerdict extends string = DefaultAnnotationVerdict, TMetadata extends Record<string, unknown> = Record<string, unknown>> = {
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
type AnnotationManifestRow<TVerdict extends string = DefaultAnnotationVerdict, TMetadata extends Record<string, unknown> = Record<string, unknown>> = AnnotationCaptureRequest<TVerdict, TMetadata> & {
    schemaVersion: typeof annotationSchemaVersion;
    elementImagePath: string;
    elementImageRelativePath: string;
    manifestJsonPath: string;
    manifestJsonlPath: string;
    viewportImagePath: string | null;
    viewportImageRelativePath: string | null;
};
type AnnotationCaptureResult<TVerdict extends string = DefaultAnnotationVerdict, TMetadata extends Record<string, unknown> = Record<string, unknown>> = {
    manifest: AnnotationManifestRow<TVerdict, TMetadata>;
};
type AnnotationPreloadApi<TVerdict extends string = DefaultAnnotationVerdict, TMetadata extends Record<string, unknown> = Record<string, unknown>> = {
    captureElement(request: AnnotationCaptureRequest<TVerdict, TMetadata>): Promise<AnnotationCaptureResult<TVerdict, TMetadata>>;
};

export { type AnnotationCaptureRequest, type AnnotationCaptureResult, type AnnotationElementIdentity, type AnnotationManifestRow, type AnnotationPreloadApi, type AnnotationRect, type AnnotationRouteSnapshot, type AnnotationViewport, type DefaultAnnotationVerdict, annotationSchemaVersion, defaultAnnotationCaptureIpcChannel, defaultAnnotationVerdicts };
