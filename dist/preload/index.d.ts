import { IpcRenderer, ContextBridge } from 'electron';
import { AnnotationPreloadApi } from '../shared/types.js';

type CreateAnnotationPreloadApiOptions = {
    channel?: string;
};
declare function createAnnotationPreloadApi(ipcRenderer: Pick<IpcRenderer, "invoke">, options?: CreateAnnotationPreloadApiOptions): AnnotationPreloadApi<string>;
declare function exposeAnnotationPreloadApi(contextBridge: Pick<ContextBridge, "exposeInMainWorld">, ipcRenderer: Pick<IpcRenderer, "invoke">, apiKey?: string, options?: CreateAnnotationPreloadApiOptions): AnnotationPreloadApi<string>;
declare global {
    interface Window {
        liveAnnotations?: AnnotationPreloadApi<string>;
    }
}

export { type CreateAnnotationPreloadApiOptions, createAnnotationPreloadApi, exposeAnnotationPreloadApi };
