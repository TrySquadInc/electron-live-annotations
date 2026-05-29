# electron-live-annotations

Framework-agnostic live annotation layer for Electron apps.

## Demo

<video src="./media/live-annotations-demo.mp4" controls muted playsinline></video>

[Download the demo video](./media/live-annotations-demo.mp4)

Browser-only review tools can inspect DOM and screenshots, but they cannot reach the native Electron layer where IPC, file dialogs, auth callbacks, packaged app boundaries, updater flows, and local filesystem state often matter. This package adds an in-app annotation layer that lets a human click the real Electron UI, write a note, and save a local receipt with:

- route and viewport state;
- stable DOM identity candidates;
- role, accessible name, text snippet, CSS selector, and XPath fallback;
- cropped element PNG and viewport PNG by default;
- append-only `manifest.jsonl` under Electron `userData`;
- framework-neutral renderer controller.

It does not require React, Vue, Svelte, Solid, or any UI framework. It is plain TypeScript and DOM APIs.

## Install

```bash
pnpm add electron-live-annotations
```

`electron` is a peer dependency.

## Wire Electron Main

Register the IPC handler after `app.whenReady()`:

```ts
import { app } from "electron";
import { registerAnnotationCaptureIpc } from "electron-live-annotations/main";

app.whenReady().then(() => {
  registerAnnotationCaptureIpc({
    shouldCapture(_request, event) {
      const url = event.sender.getURL();
      return url.startsWith("app://") || url.startsWith("file://");
    },
  });
});
```

The handler captures the active `BrowserWindow`, crops the clicked element from `webContents.capturePage()`, and writes receipts under:

```text
<app.getPath("userData")>/annotations/<sessionId>/
```

Replace the `shouldCapture` guard with your app's trusted-window policy. Do not expose screenshot capture to arbitrary remote pages. Treat annotations as a trusted-app-shell review tool unless you have a stronger product-specific permission model.

## Wire Preload

Expose the safe bridge in your preload script:

```ts
import { contextBridge, ipcRenderer } from "electron";
import { exposeAnnotationPreloadApi } from "electron-live-annotations/preload";

exposeAnnotationPreloadApi(contextBridge, ipcRenderer);
```

This exposes:

```ts
window.liveAnnotations.captureElement(request)
```

## Wire Renderer

Use the vanilla controller from any frontend framework or no framework:

```ts
import { createLiveAnnotationController } from "electron-live-annotations/renderer";

const annotations = createLiveAnnotationController({
  enabled: false,
  onSaved(result) {
    console.log("Saved annotation", result.manifest.manifestJsonlPath);
  },
});

// Cmd+. on macOS or Ctrl+. elsewhere toggles by default.
// You can also drive it from your own UI.
annotations.start();
annotations.stop();
annotations.toggle();
```

When active:

1. hover an element to outline it;
2. click it;
3. choose a verdict and write a note;
4. save.

`Esc` exits annotation mode.

## Stable Selectors

The renderer prefers stable attributes before brittle CSS/XPath selectors.

Default stable attributes:

- `data-testid`
- `data-test`
- `data-qa`
- `data-cy`
- `data-live-annotation-id`

Default stable prefixes:

- `data-live-annotation-`

Customize them:

```ts
createLiveAnnotationController({
  stableAttributeNames: ["data-testid", "data-product-id"],
  stableAttributePrefixes: ["data-acme-"],
});
```

XPath is recorded only as a fallback receipt. Agents should not treat it as stable product identity.

## Manifest Shape

Each save appends one row to `manifest.jsonl`:

```ts
type AnnotationManifestRow = {
  schemaVersion: 1;
  annotationId: string;
  sessionId: string;
  capturedAt: string;
  route: {
    href: string;
    hash: string;
    pathname: string;
    search: string;
    title: string;
  };
  rect: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number; deviceScaleFactor: number };
  element: {
    stableSelector: string | null;
    cssSelector: string;
    xpath: string;
    testId: string | null;
    dataAttributes: Record<string, string>;
    nearestStableAncestor: string | null;
    role: string | null;
    accessibleName: string | null;
    tagName: string;
    textSnippet: string | null;
  };
  verdict: string;
  note: string;
  elementImagePath: string;
  viewportImagePath: string | null;
};
```

## Privacy

All captures are local by default. This package does not upload screenshots, notes, DOM text, or manifests. The saved viewport image can contain sensitive user data from the current app window, so production apps should gate annotation mode, disclose where captures are stored, and avoid enabling capture on untrusted remote content. If your product syncs annotations elsewhere, make that explicit in your app and docs.

## What This Is Not

This is not a product truth system by itself. An annotation is a local review receipt. If your app has canonical issue tracking, mission state, approval state, telemetry, or audit logs, you must explicitly decide how annotation receipts become those product facts.

This is also not a complete native workflow verifier by itself. It records what a human selected in the real Electron renderer and persists local evidence. Proving IPC behavior, file dialogs, auth callbacks, packaged boundaries, updater flows, or filesystem state still requires product-specific verification around those flows.

## Agent Workflow

This repo includes [AGENTS.md](./AGENTS.md). If an agent is installing this package into another Electron app, point it there first. The agent should discover the host app's Electron topology, preload bridge, UI framework, selector conventions, review workflow, and privacy constraints before editing.

## Verify

```bash
pnpm install
pnpm verify
```

## Status

Initial open-source extraction from a production Electron app annotation workflow. The API is intentionally small and may change before `1.0`.
