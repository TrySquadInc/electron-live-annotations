import { app, BrowserWindow } from "electron";
import { registerAnnotationCaptureIpc } from "electron-live-annotations/main";
import { join } from "node:path";

app.whenReady().then(() => {
  registerAnnotationCaptureIpc();

  const window = new BrowserWindow({
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: join(import.meta.dirname, "preload.js"),
    },
    width: 1200,
  });

  void window.loadFile("index.html");
});
