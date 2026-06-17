import {
  defaultAnnotationCaptureIpcChannel
} from "../chunk-NE5CIZFX.js";

// src/preload/index.ts
function createAnnotationPreloadApi(ipcRenderer, options = {}) {
  const channel = options.channel ?? defaultAnnotationCaptureIpcChannel;
  return {
    async captureElement(request) {
      return await ipcRenderer.invoke(channel, request);
    }
  };
}
function exposeAnnotationPreloadApi(contextBridge, ipcRenderer, apiKey = "liveAnnotations", options = {}) {
  const api = createAnnotationPreloadApi(ipcRenderer, options);
  contextBridge.exposeInMainWorld(apiKey, api);
  return api;
}
export {
  createAnnotationPreloadApi,
  exposeAnnotationPreloadApi
};
