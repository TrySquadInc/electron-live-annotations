import type { ContextBridge, IpcRenderer } from "electron";
import {
  type AnnotationCaptureRequest,
  type AnnotationCaptureResult,
  type AnnotationPreloadApi,
  defaultAnnotationCaptureIpcChannel,
} from "../shared/types.js";

export type CreateAnnotationPreloadApiOptions = {
  channel?: string;
};

export function createAnnotationPreloadApi(
  ipcRenderer: Pick<IpcRenderer, "invoke">,
  options: CreateAnnotationPreloadApiOptions = {},
): AnnotationPreloadApi<string> {
  const channel = options.channel ?? defaultAnnotationCaptureIpcChannel;

  return {
    async captureElement(request: AnnotationCaptureRequest<string>) {
      return (await ipcRenderer.invoke(channel, request)) as AnnotationCaptureResult<string>;
    },
  };
}

export function exposeAnnotationPreloadApi(
  contextBridge: Pick<ContextBridge, "exposeInMainWorld">,
  ipcRenderer: Pick<IpcRenderer, "invoke">,
  apiKey = "liveAnnotations",
  options: CreateAnnotationPreloadApiOptions = {},
) {
  const api = createAnnotationPreloadApi(ipcRenderer, options);
  contextBridge.exposeInMainWorld(apiKey, api);
  return api;
}

declare global {
  interface Window {
    liveAnnotations?: AnnotationPreloadApi<string>;
  }
}
