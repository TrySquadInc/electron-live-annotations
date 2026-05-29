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

export type RegisterAnnotationCaptureIpcOptions<TVerdict extends string = string> = {
  channel?: string;
  getUserDataPath?: () => string;
  getWindowForWebContents?: typeof BrowserWindow.fromWebContents;
  shouldCapture?: (
    request: AnnotationCaptureRequest<TVerdict>,
    event: IpcMainInvokeEvent,
  ) => boolean | Promise<boolean>;
  verdicts?: readonly TVerdict[];
};

export function registerAnnotationCaptureIpc<TVerdict extends string = string>(
  options: RegisterAnnotationCaptureIpcOptions<TVerdict> = {},
) {
  const channel = options.channel ?? defaultAnnotationCaptureIpcChannel;
  const getUserDataPath = options.getUserDataPath ?? (() => app.getPath("userData"));
  const getWindowForWebContents =
    options.getWindowForWebContents ?? BrowserWindow.fromWebContents.bind(BrowserWindow);
  const verdicts =
    options.verdicts ?? (defaultAnnotationVerdicts as unknown as readonly TVerdict[]);

  ipcMain.handle(channel, async (event, input: unknown) => {
    const request = normalizeAnnotationCaptureRequest(input, verdicts);
    const allowed = options.shouldCapture ? await options.shouldCapture(request, event) : true;
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

    const result = { manifest } satisfies AnnotationCaptureResult<TVerdict>;
    return JSON.parse(JSON.stringify(result)) as AnnotationCaptureResult<TVerdict>;
  });

  return { channel };
}

export * from "./persistence.js";
