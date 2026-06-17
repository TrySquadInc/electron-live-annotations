import { AnnotationPreloadApi, AnnotationCaptureResult, AnnotationElementIdentity, AnnotationRect, AnnotationRouteSnapshot, AnnotationViewport } from '../shared/types.js';

type AnnotationEditorPosition = {
    x: number;
    y: number;
};
type AnnotationEditorSize = {
    height: number;
    width: number;
};
type AnnotationSelectorOptions = {
    stableAttributeNames?: readonly string[];
    stableAttributePrefixes?: readonly string[];
};
type LiveAnnotationControllerOptions<TVerdict extends string = string> = AnnotationSelectorOptions & {
    api?: AnnotationPreloadApi<TVerdict>;
    apiKey?: string;
    enabled?: boolean;
    includeViewportImage?: boolean;
    localStorageKeyPrefix?: string;
    onError?: (error: unknown) => void;
    onSaved?: (result: AnnotationCaptureResult<TVerdict>) => void;
    toggleKey?: string;
    verdicts?: readonly TVerdict[];
};
declare function readStoredAnnotationEditorPosition(localStorageKeyPrefix: string, size: AnnotationEditorSize, viewport: AnnotationEditorSize): AnnotationEditorPosition | null;
declare function writeStoredAnnotationEditorPosition(localStorageKeyPrefix: string, position: AnnotationEditorPosition): void;
declare function isEditableKeyboardTarget(target: EventTarget | null): boolean;
declare function shouldToggleAnnotationModeShortcut(event: {
    altKey?: boolean;
    ctrlKey?: boolean;
    defaultPrevented?: boolean;
    isComposing?: boolean;
    key: string;
    metaKey?: boolean;
    shiftKey?: boolean;
    targetIsEditable?: boolean;
}, expectedKey?: string): boolean;
declare function clampAnnotationEditorPosition(position: AnnotationEditorPosition, size: AnnotationEditorSize, viewport: AnnotationEditorSize, margin?: number): AnnotationEditorPosition;
declare function createAnnotationSessionId(date: Date): string;
declare function createAnnotationId(date: Date, uniqueness?: string): string;
declare function cssSelectorForElement(element: Element, options?: AnnotationSelectorOptions): string;
declare function xpathForElement(element: Element): string;
declare function dataAttributesForElement(element: Element, options?: AnnotationSelectorOptions): Record<string, string>;
declare function nearestStableAncestorSelector(element: Element, options?: AnnotationSelectorOptions): string | null;
declare function stableSelectorForElement(element: Element, options?: AnnotationSelectorOptions): string | null;
declare function annotationIdentityForElement(element: Element, options?: AnnotationSelectorOptions): AnnotationElementIdentity;
declare function rectFromElement(element: Element): AnnotationRect;
declare function viewportSnapshot(): AnnotationViewport;
declare function routeSnapshot(): AnnotationRouteSnapshot;
declare function isAnnotationOverlayElement(target: EventTarget | null): boolean;
declare function buildAnnotationCaptureRequest<TVerdict extends string = string>(input: {
    element: Element;
    includeViewportImage?: boolean;
    localStorageKeyPrefix?: string;
    note: string;
    rect?: AnnotationRect;
    selectorOptions?: AnnotationSelectorOptions;
    verdict: TVerdict;
}): {
    annotationId: string;
    capturedAt: string;
    element: AnnotationElementIdentity;
    includeViewportImage: boolean;
    note: string;
    rect: AnnotationRect;
    route: AnnotationRouteSnapshot;
    sessionId: string;
    verdict: TVerdict;
    viewport: AnnotationViewport;
};
declare function createLiveAnnotationController<TVerdict extends string = string>(options?: LiveAnnotationControllerOptions<TVerdict>): {
    destroy: () => void;
    isEnabled: () => boolean;
    selectedElement: () => Element | null;
    start: () => void;
    stop: () => void;
    toggle: () => void;
};

export { type AnnotationEditorPosition, type AnnotationEditorSize, type AnnotationSelectorOptions, type LiveAnnotationControllerOptions, annotationIdentityForElement, buildAnnotationCaptureRequest, clampAnnotationEditorPosition, createAnnotationId, createAnnotationSessionId, createLiveAnnotationController, cssSelectorForElement, dataAttributesForElement, isAnnotationOverlayElement, isEditableKeyboardTarget, nearestStableAncestorSelector, readStoredAnnotationEditorPosition, rectFromElement, routeSnapshot, shouldToggleAnnotationModeShortcut, stableSelectorForElement, viewportSnapshot, writeStoredAnnotationEditorPosition, xpathForElement };
