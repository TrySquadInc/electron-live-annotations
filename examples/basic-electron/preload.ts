import { contextBridge, ipcRenderer } from "electron";
import { exposeAnnotationPreloadApi } from "electron-live-annotations/preload";

exposeAnnotationPreloadApi(contextBridge, ipcRenderer);
