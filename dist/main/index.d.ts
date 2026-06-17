import { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { AnnotationCaptureRequest, AnnotationCaptureResult } from '../shared/types.js';
export { PersistAnnotationCaptureInput, annotationCaptureRectsForImage, annotationImageRelativePath, annotationSessionDir, clampAnnotationCaptureRect, normalizeAnnotationCaptureRequest, persistAnnotationCapture, pngDimensionsFromBuffer, sanitizeAnnotationPathSegment, scaleAnnotationCaptureRectToImage } from './persistence.js';

type ShouldCapturePredicate<TVerdict extends string = string> = (request: AnnotationCaptureRequest<TVerdict>, event: IpcMainInvokeEvent) => boolean | Promise<boolean>;
type RegisterAnnotationCaptureIpcOptions<TVerdict extends string = string> = {
    channel?: string;
    getUserDataPath?: () => string;
    getWindowForWebContents?: typeof BrowserWindow.fromWebContents;
    /**
     * Authorizes each capture request before a screenshot is taken and written to
     * disk. Captures are triggered from the renderer over IPC, so this predicate
     * is the host application's opt-in security boundary.
     *
     * When omitted, every request is allowed (see {@link allowAllCaptures}) and a
     * one-time warning is logged. Provide an explicit predicate to gate captures,
     * e.g. allow only in development with `() => !app.isPackaged`, or return
     * `false` to deny.
     */
    shouldCapture?: ShouldCapturePredicate<TVerdict>;
    verdicts?: readonly TVerdict[];
};
/**
 * Default {@link RegisterAnnotationCaptureIpcOptions.shouldCapture}: allow every
 * capture request. Exported so hosts can opt in explicitly and document intent
 * at the call site.
 */
declare const allowAllCaptures: ShouldCapturePredicate;
/**
 * Builds the `ipcMain.handle` callback that captures, crops, and persists an
 * annotation. Separated from {@link registerAnnotationCaptureIpc} so the capture
 * logic is testable without an Electron runtime (inject `getWindowForWebContents`
 * and `getUserDataPath`).
 */
declare function createAnnotationCaptureHandler<TVerdict extends string = string>(options?: RegisterAnnotationCaptureIpcOptions<TVerdict>): (event: IpcMainInvokeEvent, input: unknown) => Promise<AnnotationCaptureResult<TVerdict>>;
declare function registerAnnotationCaptureIpc<TVerdict extends string = string>(options?: RegisterAnnotationCaptureIpcOptions<TVerdict>): {
    channel: string;
};

export { type RegisterAnnotationCaptureIpcOptions, type ShouldCapturePredicate, allowAllCaptures, createAnnotationCaptureHandler, registerAnnotationCaptureIpc };
