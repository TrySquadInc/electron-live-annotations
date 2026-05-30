import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type RegisterAnnotationCaptureIpcOptions,
  allowAllCaptures,
  createAnnotationCaptureHandler,
} from "../src/main/index.js";
import type { AnnotationCaptureRequest } from "../src/shared/types.js";

vi.mock("electron", () => ({
  app: { getPath: () => "" },
  BrowserWindow: { fromWebContents: () => null },
  ipcMain: { handle: () => {} },
}));

function pngBuffer(width: number, height: number) {
  const buffer = Buffer.alloc(24);
  buffer.write("89504e470d0a1a0a", 0, "hex");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function nativeImage(png: Buffer) {
  return {
    crop: () => ({ toPNG: () => Buffer.from("element") }),
    toPNG: () => png,
  };
}

function captureRequest(
  partial: Partial<AnnotationCaptureRequest<string>> = {},
): AnnotationCaptureRequest<string> {
  return {
    annotationId: "note-main",
    capturedAt: "2026-05-30T00:00:00.000Z",
    element: {
      accessibleName: "Open file",
      cssSelector: '[data-testid="file-button"]',
      dataAttributes: { "data-testid": "file-button" },
      nearestStableAncestor: null,
      role: "button",
      stableSelector: '[data-testid="file-button"]',
      tagName: "button",
      testId: "file-button",
      textSnippet: "Open",
      xpath: "/html/body/button",
    },
    note: "Native IPC explainer.",
    rect: { height: 80, width: 120, x: 40, y: 50 },
    route: {
      hash: "",
      href: "app://index.html",
      pathname: "/index.html",
      search: "",
      title: "Example",
    },
    sessionId: "session-main",
    verdict: "note",
    viewport: { deviceScaleFactor: 2, height: 600, width: 800 },
    ...partial,
  };
}

async function handlerOptions(
  overrides: Partial<RegisterAnnotationCaptureIpcOptions<string>> = {},
): Promise<RegisterAnnotationCaptureIpcOptions<string>> {
  const userDataPath = await mkdtemp(join(tmpdir(), "ela-main-"));
  return {
    getUserDataPath: () => userDataPath,
    getWindowForWebContents: () =>
      ({
        webContents: { capturePage: async () => nativeImage(pngBuffer(1600, 1200)) },
      }) as unknown as BrowserWindow,
    ...overrides,
  };
}

const event = { sender: {} } as unknown as IpcMainInvokeEvent;

describe("annotation capture handler", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("warns once and allows capture when no shouldCapture policy is provided", async () => {
    const handler = createAnnotationCaptureHandler(await handlerOptions());
    expect(warn).toHaveBeenCalledTimes(1);

    const result = await handler(event, captureRequest());
    expect(result.manifest.annotationId).toBe("note-main");
    expect(result.manifest.elementImagePath).toContain("note-main-element.png");
    const row = await readFile(result.manifest.manifestJsonlPath, "utf8");
    expect(row).toContain('"sessionId":"session-main"');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("rejects capture when shouldCapture returns false", async () => {
    const handler = createAnnotationCaptureHandler(
      await handlerOptions({ shouldCapture: () => false }),
    );
    await expect(handler(event, captureRequest())).rejects.toThrow(
      "rejected by the host application",
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not warn when an explicit policy is provided", async () => {
    createAnnotationCaptureHandler(await handlerOptions({ shouldCapture: allowAllCaptures }));
    expect(warn).not.toHaveBeenCalled();
  });
});
