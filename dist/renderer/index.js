import {
  defaultAnnotationVerdicts
} from "../chunk-NE5CIZFX.js";

// src/renderer/index.ts
var defaultStableAttributeNames = [
  "data-testid",
  "data-test",
  "data-qa",
  "data-cy",
  "data-live-annotation-id"
];
var defaultStableAttributePrefixes = ["data-live-annotation-"];
var overlayAttribute = "data-live-annotation-overlay";
var maxTextSnippetLength = 240;
function storageKey(prefix, key) {
  return `${prefix}.${key}`;
}
function parseStoredEditorPosition(value) {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return { x: Number(parsed.x), y: Number(parsed.y) };
    }
  } catch {
    return null;
  }
  return null;
}
function readStoredAnnotationEditorPosition(localStorageKeyPrefix, size, viewport) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = parseStoredEditorPosition(
      window.localStorage.getItem(storageKey(localStorageKeyPrefix, "editorPosition"))
    );
    return stored ? clampAnnotationEditorPosition(stored, size, viewport) : null;
  } catch {
    return null;
  }
}
function writeStoredAnnotationEditorPosition(localStorageKeyPrefix, position) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      storageKey(localStorageKeyPrefix, "editorPosition"),
      JSON.stringify(position)
    );
  } catch {
    return;
  }
}
function getWindowApi(apiKey) {
  return window[apiKey];
}
function selectorConfig(options = {}) {
  return {
    stableAttributeNames: options.stableAttributeNames ?? defaultStableAttributeNames,
    stableAttributePrefixes: options.stableAttributePrefixes ?? defaultStableAttributePrefixes
  };
}
function isEditableKeyboardTarget(target) {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']") !== null;
}
function shouldToggleAnnotationModeShortcut(event, expectedKey = ".") {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || event.targetIsEditable || !event.metaKey && !event.ctrlKey) {
    return false;
  }
  return event.key === expectedKey;
}
function clampAnnotationEditorPosition(position, size, viewport, margin = 16) {
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - size.height - margin);
  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY)
  };
}
function createAnnotationSessionId(date) {
  return `annotation-${date.toISOString().replace(/[:.]/g, "-")}`;
}
function randomAnnotationToken() {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : void 0;
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(4));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2, 10).padStart(8, "0");
}
function createAnnotationId(date, uniqueness = randomAnnotationToken()) {
  return `note-${date.toISOString().replace(/[:.]/g, "-")}-${uniqueness}`;
}
function cssEscape(value) {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}
function selectorAttribute(name, value) {
  return `[${name}="${cssEscape(value)}"]`;
}
function isStableAttribute(name, value, options) {
  return Boolean(value) && (options.stableAttributeNames.includes(name) || options.stableAttributePrefixes.some((prefix) => name.startsWith(prefix)));
}
function stableAttributesForElement(element, options) {
  const dataAttributes = {};
  for (const attribute of Array.from(element.attributes)) {
    if (isStableAttribute(attribute.name, attribute.value, options)) {
      dataAttributes[attribute.name] = attribute.value;
    }
  }
  return dataAttributes;
}
function stableSelectorList(options) {
  return options.stableAttributeNames.map((name) => `[${name}]`).join(", ");
}
function findStableElement(start, options) {
  let current = start;
  while (current) {
    if (Object.keys(stableAttributesForElement(current, options)).length > 0) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
function indexedElementSegment(element) {
  const tagName = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) {
    return tagName;
  }
  const matchingSiblings = Array.from(parent.children).filter(
    (sibling) => sibling.tagName === element.tagName
  );
  if (matchingSiblings.length <= 1) {
    return tagName;
  }
  return `${tagName}:nth-of-type(${matchingSiblings.indexOf(element) + 1})`;
}
function cssSelectorForElement(element, options = {}) {
  const config = selectorConfig(options);
  const directStableAttributes = stableAttributesForElement(element, config);
  const directStableAttribute = Object.entries(directStableAttributes)[0];
  if (directStableAttribute) {
    return selectorAttribute(directStableAttribute[0], directStableAttribute[1]);
  }
  const segments = [];
  let current = element;
  while (current && current.nodeType === 1 && segments.length < 5) {
    const stableAttributes = stableAttributesForElement(current, config);
    const stableAttribute = Object.entries(stableAttributes)[0];
    if (stableAttribute) {
      segments.unshift(selectorAttribute(stableAttribute[0], stableAttribute[1]));
      break;
    }
    segments.unshift(indexedElementSegment(current));
    current = current.parentElement;
  }
  return segments.join(" > ");
}
function xpathForElement(element) {
  const segments = [];
  let current = element;
  while (current && current.nodeType === 1) {
    const tagName = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) {
      segments.unshift(tagName);
      break;
    }
    const currentTagName = current.tagName;
    const matchingSiblings = Array.from(parent.children).filter((sibling) => {
      return sibling.tagName === currentTagName;
    });
    const index = matchingSiblings.length > 1 ? `[${matchingSiblings.indexOf(current) + 1}]` : "";
    segments.unshift(`${tagName}${index}`);
    current = parent;
  }
  return `/${segments.join("/")}`;
}
function dataAttributesForElement(element, options = {}) {
  return stableAttributesForElement(element, selectorConfig(options));
}
function nearestStableAncestorSelector(element, options = {}) {
  const config = selectorConfig(options);
  const cssMatch = element.parentElement?.closest(stableSelectorList(config));
  const ancestor = cssMatch ?? findStableElement(element.parentElement, config);
  return ancestor ? cssSelectorForElement(ancestor, options) : null;
}
function nearestStableIdentityElement(element, options = {}) {
  const directDataAttributes = dataAttributesForElement(element, options);
  if (Object.keys(directDataAttributes).length > 0) {
    return element;
  }
  const config = selectorConfig(options);
  return element.closest(stableSelectorList(config)) ?? findStableElement(element, config) ?? element;
}
function stableSelectorForElement(element, options = {}) {
  const directDataAttributes = dataAttributesForElement(element, options);
  const directStableAttribute = Object.entries(directDataAttributes)[0];
  if (directStableAttribute) {
    return selectorAttribute(directStableAttribute[0], directStableAttribute[1]);
  }
  return nearestStableAncestorSelector(element, options);
}
function normalizeTextSnippet(text) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, maxTextSnippetLength);
}
function annotationIdentityForElement(element, options = {}) {
  const stableIdentityElement = nearestStableIdentityElement(element, options);
  const role = element.getAttribute("role");
  const ariaLabel = element.getAttribute("aria-label") ?? element.getAttribute("title");
  return {
    accessibleName: normalizeTextSnippet(ariaLabel),
    cssSelector: cssSelectorForElement(element, options),
    dataAttributes: dataAttributesForElement(stableIdentityElement, options),
    nearestStableAncestor: nearestStableAncestorSelector(element, options),
    role,
    stableSelector: stableSelectorForElement(element, options),
    tagName: element.tagName.toLowerCase(),
    testId: stableIdentityElement.getAttribute("data-testid"),
    textSnippet: normalizeTextSnippet(element.textContent),
    xpath: xpathForElement(element)
  };
}
function rectFromElement(element) {
  const rect = element.getBoundingClientRect();
  return {
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y
  };
}
function viewportSnapshot() {
  return {
    deviceScaleFactor: window.devicePixelRatio || 1,
    height: window.innerHeight,
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0,
    width: window.innerWidth
  };
}
function routeSnapshot() {
  return {
    hash: window.location.hash,
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    title: document.title
  };
}
function isAnnotationOverlayElement(target) {
  return typeof Element !== "undefined" && target instanceof Element && target.closest(`[${overlayAttribute}="true"]`) !== null;
}
function buildAnnotationCaptureRequest(input) {
  const capturedAt = /* @__PURE__ */ new Date();
  const localStorageKeyPrefix = input.localStorageKeyPrefix ?? "electron-live-annotations";
  const sessionKey = storageKey(localStorageKeyPrefix, "activeSessionId");
  const existing = window.localStorage.getItem(sessionKey);
  const sessionId = existing ?? createAnnotationSessionId(capturedAt);
  if (!existing) {
    window.localStorage.setItem(sessionKey, sessionId);
  }
  return {
    annotationId: createAnnotationId(capturedAt),
    capturedAt: capturedAt.toISOString(),
    element: annotationIdentityForElement(input.element, input.selectorOptions),
    includeViewportImage: input.includeViewportImage ?? true,
    note: input.note,
    rect: input.rect ?? rectFromElement(input.element),
    route: routeSnapshot(),
    sessionId,
    verdict: input.verdict,
    viewport: viewportSnapshot()
  };
}
function applyBaseStyles(element, styles) {
  for (const [key, value] of Object.entries(styles)) {
    if (value !== void 0) {
      element.style.setProperty(key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`), value);
    }
  }
}
function createOverlayElement() {
  const element = document.createElement("div");
  element.setAttribute(overlayAttribute, "true");
  element.style.pointerEvents = "none";
  applyBaseStyles(element, {
    border: "2px solid #14b8a6",
    borderRadius: "6px",
    boxShadow: "0 0 0 99999px rgba(15, 23, 42, 0.16)",
    display: "none",
    left: "0",
    position: "fixed",
    top: "0",
    zIndex: "2147483000"
  });
  return element;
}
function createEditorElement(verdicts) {
  const editor = document.createElement("form");
  editor.setAttribute(overlayAttribute, "true");
  editor.innerHTML = `
    <div data-live-annotation-drag-handle="true" title="Drag annotation editor" style="cursor:grab;margin:-14px -14px 10px;padding:14px 14px 10px;touch-action:none;user-select:none;">
      <div data-live-annotation-title style="font-weight:600;margin-bottom:2px;">Capture annotation</div>
      <div data-live-annotation-selector style="color:#64748b;font:12px ui-monospace, SFMono-Regular, Menlo, monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
    </div>
    <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Verdict</label>
    <select data-live-annotation-verdict style="box-sizing:border-box;margin-bottom:8px;width:100%;"></select>
    <textarea data-live-annotation-note placeholder="What should change here?" style="box-sizing:border-box;height:108px;margin-bottom:10px;resize:vertical;width:100%;"></textarea>
    <div style="align-items:center;display:flex;gap:8px;justify-content:space-between;">
      <span data-live-annotation-status style="color:#64748b;font-size:12px;">Cmd/Ctrl+. toggles, Esc exits</span>
      <div style="display:flex;gap:8px;">
        <button type="button" data-live-annotation-cancel>Cancel</button>
        <button type="submit" data-live-annotation-save>Save</button>
      </div>
    </div>
  `;
  applyBaseStyles(editor, {
    background: "#ffffff",
    border: "1px solid #dbe3ea",
    borderRadius: "10px",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.22)",
    boxSizing: "border-box",
    color: "#0f172a",
    display: "none",
    font: "14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    left: "16px",
    padding: "14px",
    position: "fixed",
    top: "16px",
    width: "360px",
    zIndex: "2147483001"
  });
  const select = editor.querySelector("[data-live-annotation-verdict]");
  if (select) {
    for (const verdict of verdicts) {
      const option = document.createElement("option");
      option.value = verdict;
      option.textContent = verdict;
      select.append(option);
    }
  }
  return editor;
}
function createLiveAnnotationController(options = {}) {
  const apiKey = options.apiKey ?? "liveAnnotations";
  const api = options.api ?? getWindowApi(apiKey);
  const verdicts = options.verdicts ?? defaultAnnotationVerdicts;
  const localStorageKeyPrefix = options.localStorageKeyPrefix ?? "electron-live-annotations";
  const toggleKey = options.toggleKey ?? ".";
  let enabled = false;
  let noteDraft = "";
  let selectedElement = null;
  let hoverElement = null;
  let editorDragState = null;
  const outline = createOverlayElement();
  const editor = createEditorElement(verdicts);
  const selectorLabel = editor.querySelector("[data-live-annotation-selector]");
  const status = editor.querySelector("[data-live-annotation-status]");
  const note = editor.querySelector("[data-live-annotation-note]");
  const verdict = editor.querySelector("[data-live-annotation-verdict]");
  const cancel = editor.querySelector("[data-live-annotation-cancel]");
  const dragHandle = editor.querySelector("[data-live-annotation-drag-handle]");
  function setStatus(value) {
    if (status) {
      status.textContent = value;
    }
  }
  function moveOutline(element) {
    if (!element || element === document.documentElement || element === document.body) {
      outline.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    outline.style.display = "block";
    outline.style.height = `${Math.max(1, rect.height)}px`;
    outline.style.left = `${rect.x}px`;
    outline.style.top = `${rect.y}px`;
    outline.style.width = `${Math.max(1, rect.width)}px`;
  }
  function openEditor(element) {
    selectedElement = element;
    const rect = element.getBoundingClientRect();
    editor.style.display = "block";
    const size = editorSize();
    const editorPosition = readStoredAnnotationEditorPosition(localStorageKeyPrefix, size, {
      height: window.innerHeight,
      width: window.innerWidth
    }) ?? clampAnnotationEditorPosition(
      { x: rect.right + 12, y: rect.top },
      size,
      { height: window.innerHeight, width: window.innerWidth }
    );
    editor.style.left = `${editorPosition.x}px`;
    editor.style.top = `${editorPosition.y}px`;
    if (selectorLabel) {
      selectorLabel.textContent = stableSelectorForElement(element, options) ?? cssSelectorForElement(element, options);
    }
    if (note) {
      note.value = noteDraft;
      window.setTimeout(() => note.focus(), 0);
    }
    setStatus("Ready to save");
  }
  function editorSize() {
    return {
      height: editor.offsetHeight || 230,
      width: editor.offsetWidth || 360
    };
  }
  function closeEditor() {
    selectedElement = null;
    editorDragState = null;
    editor.style.display = "none";
  }
  function onCancel() {
    noteDraft = "";
    closeEditor();
  }
  function start() {
    if (enabled) {
      return;
    }
    enabled = true;
    document.body.append(outline, editor);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("click", onClick, true);
  }
  function stop() {
    if (!enabled) {
      return;
    }
    enabled = false;
    closeEditor();
    outline.style.display = "none";
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("click", onClick, true);
  }
  function toggle() {
    if (enabled) {
      stop();
    } else {
      start();
    }
  }
  function destroy() {
    stop();
    dragHandle?.removeEventListener("pointerdown", onEditorPointerDown);
    dragHandle?.removeEventListener("pointermove", onEditorPointerMove);
    dragHandle?.removeEventListener("pointerup", onEditorPointerUp);
    dragHandle?.removeEventListener("pointercancel", onEditorPointerUp);
    editor.removeEventListener("submit", onSubmit);
    window.removeEventListener("keydown", onKeyDown, true);
    outline.remove();
    editor.remove();
  }
  function onMouseMove(event) {
    if (!enabled || isAnnotationOverlayElement(event.target)) {
      return;
    }
    hoverElement = event.target instanceof Element ? event.target : null;
    moveOutline(hoverElement);
  }
  function onClick(event) {
    if (!enabled || isAnnotationOverlayElement(event.target)) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    hoverElement = target;
    moveOutline(target);
    openEditor(target);
  }
  function onKeyDown(event) {
    if (shouldToggleAnnotationModeShortcut(
      {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        defaultPrevented: event.defaultPrevented,
        isComposing: event.isComposing,
        key: event.key,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        targetIsEditable: isEditableKeyboardTarget(event.target)
      },
      toggleKey
    )) {
      event.preventDefault();
      toggle();
      return;
    }
    if (event.key === "Escape" && enabled) {
      event.preventDefault();
      if (selectedElement) {
        noteDraft = note?.value ?? noteDraft;
        closeEditor();
      } else {
        stop();
      }
    }
  }
  async function onSubmit(event) {
    event.preventDefault();
    if (!selectedElement) {
      setStatus("Select an element first");
      return;
    }
    const captureApi = api ?? getWindowApi(apiKey);
    if (!captureApi) {
      setStatus(`Missing window.${apiKey}.captureElement`);
      return;
    }
    try {
      setStatus("Saving...");
      const request = buildAnnotationCaptureRequest({
        element: selectedElement,
        includeViewportImage: options.includeViewportImage ?? true,
        localStorageKeyPrefix,
        note: note?.value ?? "",
        selectorOptions: options,
        verdict: verdict?.value || verdicts[0] || "note"
      });
      const result = await captureApi.captureElement(request);
      options.onSaved?.(result);
      noteDraft = "";
      setStatus(`Saved ${result.manifest.annotationId}`);
      closeEditor();
    } catch (error) {
      options.onError?.(error);
      setStatus(error instanceof Error ? error.message : "Save failed");
    }
  }
  function onEditorPointerDown(event) {
    if (event.button !== 0 || !(event.target instanceof Element)) {
      return;
    }
    if (event.target.closest("button, input, select, textarea, a")) {
      return;
    }
    const dragElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : editor;
    const rect = editor.getBoundingClientRect();
    editorDragState = {
      pointerId: event.pointerId,
      startLeft: rect.left,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startTop: rect.top
    };
    dragElement.setPointerCapture?.(event.pointerId);
    dragElement.style.cursor = "grabbing";
    editor.style.cursor = "grabbing";
    event.preventDefault();
  }
  function onEditorPointerMove(event) {
    if (!editorDragState || event.pointerId !== editorDragState.pointerId) {
      return;
    }
    const nextPosition = clampAnnotationEditorPosition(
      {
        x: editorDragState.startLeft + event.clientX - editorDragState.startPointerX,
        y: editorDragState.startTop + event.clientY - editorDragState.startPointerY
      },
      editorSize(),
      { height: window.innerHeight, width: window.innerWidth }
    );
    editor.style.left = `${nextPosition.x}px`;
    editor.style.top = `${nextPosition.y}px`;
    event.preventDefault();
  }
  function onEditorPointerUp(event) {
    if (editorDragState && event.pointerId === editorDragState.pointerId) {
      const nextPosition = clampAnnotationEditorPosition(
        {
          x: editorDragState.startLeft + event.clientX - editorDragState.startPointerX,
          y: editorDragState.startTop + event.clientY - editorDragState.startPointerY
        },
        editorSize(),
        { height: window.innerHeight, width: window.innerWidth }
      );
      editor.style.left = `${nextPosition.x}px`;
      editor.style.top = `${nextPosition.y}px`;
      writeStoredAnnotationEditorPosition(localStorageKeyPrefix, nextPosition);
      const dragElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : editor;
      dragElement.releasePointerCapture?.(event.pointerId);
      dragElement.style.cursor = "grab";
      editor.style.cursor = "";
      editorDragState = null;
      event.preventDefault();
    }
  }
  editor.addEventListener("submit", onSubmit);
  dragHandle?.addEventListener("pointerdown", onEditorPointerDown);
  dragHandle?.addEventListener("pointermove", onEditorPointerMove);
  dragHandle?.addEventListener("pointerup", onEditorPointerUp);
  dragHandle?.addEventListener("pointercancel", onEditorPointerUp);
  cancel?.addEventListener("click", onCancel);
  window.addEventListener("keydown", onKeyDown, true);
  setStatus(`Cmd/Ctrl+${toggleKey} toggles, Esc exits`);
  if (options.enabled ?? false) {
    start();
  }
  return {
    destroy,
    isEnabled: () => enabled,
    selectedElement: () => selectedElement,
    start,
    stop,
    toggle
  };
}
export {
  annotationIdentityForElement,
  buildAnnotationCaptureRequest,
  clampAnnotationEditorPosition,
  createAnnotationId,
  createAnnotationSessionId,
  createLiveAnnotationController,
  cssSelectorForElement,
  dataAttributesForElement,
  isAnnotationOverlayElement,
  isEditableKeyboardTarget,
  nearestStableAncestorSelector,
  readStoredAnnotationEditorPosition,
  rectFromElement,
  routeSnapshot,
  shouldToggleAnnotationModeShortcut,
  stableSelectorForElement,
  viewportSnapshot,
  writeStoredAnnotationEditorPosition,
  xpathForElement
};
