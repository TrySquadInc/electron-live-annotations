import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  annotationCaptureRectsForImage,
  annotationImageRelativePath,
  persistAnnotationCapture,
  sanitizeAnnotationPathSegment,
} from "../src/main/persistence.js";
import type { AnnotationCaptureRequest } from "../src/shared/types.js";

function request(partial: Partial<AnnotationCaptureRequest<string>> = {}): AnnotationCaptureRequest<string> {
  return {
    annotationId: "note:one",
    capturedAt: "2026-05-29T18:00:00.000Z",
    element: {
      accessibleName: "Open file",
      cssSelector: "[data-testid=\"file-button\"]",
      dataAttributes: { "data-testid": "file-button" },
      nearestStableAncestor: null,
      role: "button",
      stableSelector: "[data-testid=\"file-button\"]",
      tagName: "button",
      testId: "file-button",
      textSnippet: "Open",
      xpath: "/html/body/button",
    },
    note: "Open file should explain native IPC.",
    rect: { height: 80, width: 120, x: 40, y: 50 },
    route: {
      hash: "",
      href: "app://index.html",
      pathname: "/index.html",
      search: "",
      title: "Example",
    },
    sessionId: "session:one",
    verdict: "note",
    viewport: { deviceScaleFactor: 2, height: 600, width: 800 },
    ...partial,
  };
}

describe("main persistence helpers", () => {
  it("sanitizes path segments and image paths", () => {
    expect(sanitizeAnnotationPathSegment("../bad", "fallback")).toBe("bad");
    expect(sanitizeAnnotationPathSegment("..", "fallback")).toBe("fallback");
    expect(annotationImageRelativePath("../bad", "element")).toContain("bad-element.png");
  });

  it("clamps and scales capture rects into captured image space", () => {
    expect(
      annotationCaptureRectsForImage(
        request({ rect: { height: 200, width: 300, x: 700, y: 550 } }),
        { height: 1200, width: 1600 },
      ),
    ).toEqual({
      imageRect: { height: 100, width: 200, x: 1400, y: 1100 },
      rect: { height: 50, width: 100, x: 700, y: 550 },
    });
  });

  it("persists append-only manifest rows and image files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "electron-live-annotations-"));
    const manifest = await persistAnnotationCapture({
      elementImage: Buffer.from("element"),
      request: request(),
      userDataPath: dir,
      viewportImage: Buffer.from("viewport"),
    });

    expect(manifest.elementImagePath).toContain("note-one-element.png");
    expect(manifest.viewportImagePath).toContain("note-one-viewport.png");
    const row = await readFile(manifest.manifestJsonlPath, "utf8");
    expect(row).toContain("\"annotationId\":\"note:one\"");
    const pointer = await readFile(manifest.manifestJsonPath, "utf8");
    expect(pointer).toContain("manifestJsonlPath");
  });
});
