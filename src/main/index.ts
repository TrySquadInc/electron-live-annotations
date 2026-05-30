import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  type AnnotationCaptureRequest,
  type AnnotationCaptureResult,
  defaultAnnotationCaptureIpcChannel,
  defaultAnnotationVerdicts,
} from "../shared/types.js";
import {
  annotationCaptureRectsForImage,
  normalizeAnnotationCaptureRequest,
  persistAnnotationCapture,
  pngDimensionsFromBuffer,
} from "./persistence.js";

export type ShouldCapturePredicate<TVerdict extends string = string> = (
  request: AnnotationCaptureRequest<TVerdict>,
  event: IpcMainInvokeEvent,
) => boolean | Promise<boolean>;

export type RegisterAnnotationCaptureIpcOptions<TVerdict extends string = string> = {
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
export const allowAllCaptures: ShouldCapturePredicate = () => true;

/**
 * Builds the `ipcMain.handle` callback that captures, crops, and persists an
 * annotation. Separated from {@link registerAnnotationCaptureIpc} so the capture
 * logic is testable without an Electron runtime (inject `getWindowForWebContents`
 * and `getUserDataPath`).
 */
export function createAnnotationCaptureHandler<TVerdict extends string = string>(
  options: RegisterAnnotationCaptureIpcOptions<TVerdict> = {},
) {
  const getUserDataPath = options.getUserDataPath ?? (() => app.getPath("userData"));
  const getWindowForWebContents =
    options.getWindowForWebContents ?? BrowserWindow.fromWebContents.bind(BrowserWindow);
  const verdicts =
    options.verdicts ?? (defaultAnnotationVerdicts as unknown as readonly TVerdict[]);
  const shouldCapture =
    options.shouldCapture ?? (allowAllCaptures as ShouldCapturePredicate<TVerdict>);

  if (!options.shouldCapture) {
    console.warn(
      "[electron-live-annotations] No `shouldCapture` policy was provided, so every annotation " +
        "capture request from the renderer will be allowed. Pass `shouldCapture` to " +
        "registerAnnotationCaptureIpc to gate captures (recommended for production).",
    );
  }

  return async (
    event: IpcMainInvokeEvent,
    input: unknown,
  ): Promise<AnnotationCaptureResult<TVerdict>> => {
    const request = normalizeAnnotationCaptureRequest(input, verdicts);
    const allowed = await shouldCapture(request, event);
    if (!allowed) {
      throw new Error("Annotation capture was rejected by the host application.");
    }

    const window = getWindowForWebContents(event.sender);
    if (!window) {
      throw new Error("Annotation capture requires an active Electron BrowserWindow.");
    }

    const pageImage = await window.webContents.capturePage();
    const pageImagePng = pageImage.toPNG();
    const viewportImage = request.includeViewportImage ? pageImagePng : null;
    const { imageRect, rect } = annotationCaptureRectsForImage(
      request as AnnotationCaptureRequest<string>,
      pngDimensionsFromBuffer(pageImagePng),
    );
    const elementImage = pageImage.crop(imageRect);

    const manifest = await persistAnnotationCapture({
      elementImage: elementImage.toPNG(),
      request: {
        ...request,
        rect,
      },
      userDataPath: getUserDataPath(),
      viewportImage,
    });

    return { manifest } satisfies AnnotationCaptureResult<TVerdict>;
  };
}

export function registerAnnotationCaptureIpc<TVerdict extends string = string>(
  options: RegisterAnnotationCaptureIpcOptions<TVerdict> = {},
) {
  const channel = options.channel ?? defaultAnnotationCaptureIpcChannel;
  ipcMain.handle(channel, createAnnotationCaptureHandler(options));
  return { channel };
}

export * from "./persistence.js";
