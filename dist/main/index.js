import {
  annotationCaptureRectsForImage,
  annotationImageRelativePath,
  annotationSessionDir,
  clampAnnotationCaptureRect,
  normalizeAnnotationCaptureRequest,
  persistAnnotationCapture,
  pngDimensionsFromBuffer,
  sanitizeAnnotationPathSegment,
  scaleAnnotationCaptureRectToImage
} from "../chunk-RAHORPLM.js";
import {
  defaultAnnotationCaptureIpcChannel,
  defaultAnnotationVerdicts
} from "../chunk-NE5CIZFX.js";

// src/main/index.ts
import { app, BrowserWindow, ipcMain } from "electron";
var allowAllCaptures = () => true;
function createAnnotationCaptureHandler(options = {}) {
  const getUserDataPath = options.getUserDataPath ?? (() => app.getPath("userData"));
  const getWindowForWebContents = options.getWindowForWebContents ?? BrowserWindow.fromWebContents.bind(BrowserWindow);
  const verdicts = options.verdicts ?? defaultAnnotationVerdicts;
  const shouldCapture = options.shouldCapture ?? allowAllCaptures;
  if (!options.shouldCapture) {
    console.warn(
      "[electron-live-annotations] No `shouldCapture` policy was provided, so every annotation capture request from the renderer will be allowed. Pass `shouldCapture` to registerAnnotationCaptureIpc to gate captures (recommended for production)."
    );
  }
  return async (event, input) => {
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
      request,
      pngDimensionsFromBuffer(pageImagePng)
    );
    const elementImage = pageImage.crop(imageRect);
    const manifest = await persistAnnotationCapture({
      elementImage: elementImage.toPNG(),
      request: {
        ...request,
        rect
      },
      userDataPath: getUserDataPath(),
      viewportImage
    });
    return { manifest };
  };
}
function registerAnnotationCaptureIpc(options = {}) {
  const channel = options.channel ?? defaultAnnotationCaptureIpcChannel;
  ipcMain.handle(channel, createAnnotationCaptureHandler(options));
  return { channel };
}
export {
  allowAllCaptures,
  annotationCaptureRectsForImage,
  annotationImageRelativePath,
  annotationSessionDir,
  clampAnnotationCaptureRect,
  createAnnotationCaptureHandler,
  normalizeAnnotationCaptureRequest,
  persistAnnotationCapture,
  pngDimensionsFromBuffer,
  registerAnnotationCaptureIpc,
  sanitizeAnnotationPathSegment,
  scaleAnnotationCaptureRectToImage
};
