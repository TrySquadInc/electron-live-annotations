import { describe, expect, it, vi } from "vitest";
import { createAnnotationPreloadApi } from "../src/preload/index.js";

describe("preload bridge", () => {
  it("awaits ipcRenderer.invoke before resolving captureElement", async () => {
    const manifest = {
      annotationId: "note-one",
      manifestJsonlPath: "/tmp/manifest.jsonl",
    };
    const invoke = vi.fn().mockResolvedValue({ manifest });
    const api = createAnnotationPreloadApi({ invoke });

    await expect(api.captureElement({ annotationId: "note-one" } as never)).resolves.toEqual({
      manifest,
    });
    expect(invoke).toHaveBeenCalledWith("electron-live-annotations:capture-element", {
      annotationId: "note-one",
    });
  });
});
