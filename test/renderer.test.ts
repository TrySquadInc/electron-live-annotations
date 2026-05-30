import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  annotationIdentityForElement,
  createAnnotationId,
  clampAnnotationEditorPosition,
  createLiveAnnotationController,
  cssSelectorForElement,
  dataAttributesForElement,
  isAnnotationOverlayElement,
  readStoredAnnotationEditorPosition,
  shouldToggleAnnotationModeShortcut,
  stableSelectorForElement,
  viewportSnapshot,
  writeStoredAnnotationEditorPosition,
  xpathForElement,
} from "../src/renderer/index.js";

type FakeAttribute = { name: string; value: string };

type FakeElementNode = {
  __fakeElement: true;
  append: (child: FakeElementNode) => FakeElementNode;
  attributes: FakeAttribute[];
  children: FakeElementNode[];
  closest: (selector: string) => FakeElementNode | null;
  getAttribute: (name: string) => string | null;
  isContentEditable: boolean;
  nodeType: number;
  parentElement: FakeElementNode | null;
  tagName: string;
  textContent: string;
};

type FakeDomRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;
};

type FakePointerEvent = {
  button: number;
  clientX: number;
  clientY: number;
  currentTarget?: TestDomElement;
  defaultPrevented?: boolean;
  pointerId: number;
  preventDefault: () => void;
  stopPropagation?: () => void;
  target: TestDomElement;
};

type FakeDomEventListener = (event: any) => void;

const fakeElementRuntime = Object.defineProperty(() => null, Symbol.hasInstance, {
  value(value: unknown) {
    return Boolean((value as Partial<FakeElementNode> | null)?.__fakeElement);
  },
});

function makeFakeElement(
  tagName: string,
  attrs: Record<string, string> = {},
  textContent = "",
): FakeElementNode {
  const element: FakeElementNode = {
    __fakeElement: true,
    append(child) {
      child.parentElement = element;
      element.children.push(child);
      return child;
    },
    attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    children: [],
    closest(selector) {
      const selectors = selector.split(",").map((entry) => entry.trim());
      let current: FakeElementNode | null = element;
      while (current) {
        const candidate = current;
        if (
          selectors.some((entry) => {
            const exact = entry.match(/^\[([^=\]]+)="([^"]+)"\]$/);
            if (exact) {
              return candidate.getAttribute(exact[1] ?? "") === exact[2];
            }

            const present = entry.match(/^\[([^\]]+)\]$/);
            if (present) {
              return candidate.getAttribute(present[1] ?? "") !== null;
            }

            const prefix = entry.match(/^\[([^\]]+)\*\]$/);
            if (prefix) {
              return candidate.attributes.some((attribute) =>
                attribute.name.startsWith(prefix[1] ?? ""),
              );
            }

            return false;
          })
        ) {
          return current;
        }
        current = current.parentElement;
      }

      return null;
    },
    getAttribute(name) {
      return element.attributes.find((attribute) => attribute.name === name)?.value ?? null;
    },
    isContentEditable: false,
    nodeType: 1,
    parentElement: null,
    tagName,
    textContent,
  };

  return element;
}

class TestStyle {
  [key: string]: string | ((name: string, value: string) => void);

  setProperty(name: string, value: string) {
    this[name] = value;
    this[name.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase())] = value;
  }
}

class TestDomElement {
  __fakeElement = true;
  attributes: FakeAttribute[] = [];
  children: TestDomElement[] = [];
  isContentEditable = false;
  listeners = new Map<string, FakeDomEventListener[]>();
  nodeType = 1;
  offsetHeight = 230;
  offsetWidth = 360;
  parentElement: TestDomElement | null = null;
  rect: FakeDomRect | null = null;
  style = new TestStyle();
  textContent = "";
  value = "";

  constructor(public tagName: string) {}

  set innerHTML(value: string) {
    this.children = [];
    if (!value.includes("data-live-annotation-drag-handle")) {
      return;
    }

    const dragHandle = this.append(new TestDomElement("DIV"));
    dragHandle.setAttribute("data-live-annotation-drag-handle", "true");
    dragHandle.style.cursor = "grab";
    dragHandle.append(new TestDomElement("DIV")).setAttribute("data-live-annotation-title", "");
    dragHandle.append(new TestDomElement("DIV")).setAttribute("data-live-annotation-selector", "");

    this.append(new TestDomElement("SELECT")).setAttribute("data-live-annotation-verdict", "");
    this.append(new TestDomElement("TEXTAREA")).setAttribute("data-live-annotation-note", "");
    this.append(new TestDomElement("SPAN")).setAttribute("data-live-annotation-status", "");
    this.append(new TestDomElement("BUTTON")).setAttribute("data-live-annotation-cancel", "");
    this.append(new TestDomElement("BUTTON")).setAttribute("data-live-annotation-save", "");
  }

  addEventListener(type: string, listener: FakeDomEventListener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  append<T extends TestDomElement>(child: T, ...rest: TestDomElement[]) {
    for (const next of [child, ...rest]) {
      if (next.parentElement) {
        next.parentElement.children = next.parentElement.children.filter(
          (candidate) => candidate !== next,
        );
      }
      next.parentElement = this;
      this.children.push(next);
    }
    return child;
  }

  closest(selector: string) {
    const selectors = selector.split(",").map((entry) => entry.trim());
    let current: TestDomElement | null = this;
    while (current) {
      if (selectors.some((entry) => current?.matches(entry))) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  dispatchPointer(type: string, input: Omit<FakePointerEvent, "currentTarget" | "preventDefault">) {
    const event: FakePointerEvent = {
      ...input,
      preventDefault() {
        event.defaultPrevented = true;
      },
    };

    for (const listener of this.listeners.get(type) ?? []) {
      event.currentTarget = this;
      listener(event);
    }

    return event;
  }

  focus() {}

  getAttribute(name: string) {
    return this.attributes.find((attribute) => attribute.name === name)?.value ?? null;
  }

  getBoundingClientRect() {
    const left = Number.parseFloat(String(this.style.left ?? "0"));
    const top = Number.parseFloat(String(this.style.top ?? "0"));
    return (
      this.rect ?? {
        bottom: top + this.offsetHeight,
        height: this.offsetHeight,
        left,
        right: left + this.offsetWidth,
        top,
        width: this.offsetWidth,
        x: left,
        y: top,
      }
    );
  }

  matches(selector: string) {
    const attribute = selector.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/);
    if (attribute) {
      const name = attribute[1] ?? "";
      const value = attribute[2];
      const actual = this.getAttribute(name);
      return value === undefined ? actual !== null : actual === value;
    }

    return selector.toLowerCase() === this.tagName.toLowerCase();
  }

  querySelector<T = TestDomElement>(selector: string): T | null {
    for (const child of this.children) {
      if (child.matches(selector)) {
        return child as T;
      }
      const descendant = child.querySelector<T>(selector);
      if (descendant) {
        return descendant;
      }
    }
    return null;
  }

  releasePointerCapture() {}

  remove() {
    if (!this.parentElement) {
      return;
    }
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  removeEventListener(type: string, listener: FakeDomEventListener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
    );
  }

  setAttribute(name: string, value: string) {
    const existing = this.attributes.find((attribute) => attribute.name === name);
    if (existing) {
      existing.value = value;
      return;
    }
    this.attributes.push({ name, value });
  }

  setPointerCapture() {}
}

function makePointerEvent(target: TestDomElement, input: Partial<FakePointerEvent>) {
  return {
    button: input.button ?? 0,
    clientX: input.clientX ?? 0,
    clientY: input.clientY ?? 0,
    defaultPrevented: false,
    pointerId: input.pointerId ?? 1,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation: vi.fn(),
    target,
  } satisfies FakePointerEvent;
}

function makeKeyboardEvent(
  key: string,
  input: Partial<KeyboardEvent> = {},
): KeyboardEvent & { defaultPrevented: boolean } {
  const event = {
    altKey: input.altKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    defaultPrevented: false,
    isComposing: input.isComposing ?? false,
    key,
    metaKey: input.metaKey ?? false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    shiftKey: input.shiftKey ?? false,
    target: input.target ?? null,
  };

  return event as KeyboardEvent & { defaultPrevented: boolean };
}

function installControllerDom() {
  const windowListeners = new Map<string, FakeDomEventListener[]>();
  const body = new TestDomElement("BODY");
  const documentElement = new TestDomElement("HTML");
  const storage = new Map<string, string>();

  vi.stubGlobal("Element", TestDomElement);
  vi.stubGlobal("HTMLElement", TestDomElement);
  vi.stubGlobal("HTMLTextAreaElement", TestDomElement);
  vi.stubGlobal("window", {
    addEventListener: (type: string, listener: FakeDomEventListener) => {
      const listeners = windowListeners.get(type) ?? [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
    devicePixelRatio: 2,
    innerHeight: 640,
    innerWidth: 1024,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    location: {
      hash: "",
      href: "app://index.html",
      pathname: "/index.html",
      search: "",
    },
    removeEventListener: (type: string, listener: FakeDomEventListener) => {
      windowListeners.set(
        type,
        (windowListeners.get(type) ?? []).filter((candidate) => candidate !== listener),
      );
    },
    scrollX: 14,
    scrollY: 28,
    setTimeout: (callback: () => void) => {
      callback();
      return 0;
    },
  });
  vi.stubGlobal("document", {
    body,
    createElement: (tagName: string) => new TestDomElement(tagName.toUpperCase()),
    documentElement,
    elementFromPoint: vi.fn(),
    title: "Test",
  });

  return { body, documentElement, storage, windowListeners };
}

describe("renderer annotation helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("Element", fakeElementRuntime);
    vi.stubGlobal("HTMLElement", fakeElementRuntime);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("claims the configured toggle shortcut without taking editable targets", () => {
    expect(shouldToggleAnnotationModeShortcut({ key: ".", metaKey: true })).toBe(true);
    expect(shouldToggleAnnotationModeShortcut({ key: ".", ctrlKey: true })).toBe(true);
    expect(shouldToggleAnnotationModeShortcut({ key: "k", metaKey: true }, "k")).toBe(true);
    expect(shouldToggleAnnotationModeShortcut({ key: ".", metaKey: true }, "k")).toBe(false);
    expect(
      shouldToggleAnnotationModeShortcut({ key: ".", metaKey: true, targetIsEditable: true }),
    ).toBe(false);
    expect(shouldToggleAnnotationModeShortcut({ key: ".", metaKey: true, shiftKey: true })).toBe(
      false,
    );
    expect(shouldToggleAnnotationModeShortcut({ key: "k", metaKey: true })).toBe(false);
  });

  it("adds entropy to annotation ids while keeping deterministic injection for tests", () => {
    const date = new Date("2026-05-30T00:00:00.000Z");

    expect(createAnnotationId(date, "abc123ef")).toBe(
      "note-2026-05-30T00-00-00-000Z-abc123ef",
    );
  });

  it("captures viewport scroll offsets", () => {
    vi.stubGlobal("window", {
      devicePixelRatio: 2,
      innerHeight: 600,
      innerWidth: 800,
      scrollX: 24,
      scrollY: 48,
    });

    expect(viewportSnapshot()).toEqual({
      deviceScaleFactor: 2,
      height: 600,
      scrollX: 24,
      scrollY: 48,
      width: 800,
    });
  });

  it("prefers configured stable attributes over brittle selectors", () => {
    const root = makeFakeElement("MAIN", { "data-testid": "settings-page" });
    const button = root.append(
      makeFakeElement(
        "BUTTON",
        {
          "aria-label": "Connect source",
          "data-live-annotation-id": "source-connect-button",
          role: "button",
        },
        "Connect",
      ),
    );

    expect(cssSelectorForElement(button as unknown as Element)).toBe(
      '[data-live-annotation-id="source-connect-button"]',
    );
    expect(stableSelectorForElement(button as unknown as Element)).toBe(
      '[data-live-annotation-id="source-connect-button"]',
    );
    expect(dataAttributesForElement(button as unknown as Element)).toEqual({
      "data-live-annotation-id": "source-connect-button",
    });
    expect(annotationIdentityForElement(button as unknown as Element)).toMatchObject({
      accessibleName: "Connect source",
      role: "button",
      textSnippet: "Connect",
    });
  });

  it("does not treat app-specific data prefixes as built-in stable selectors", () => {
    const button = makeFakeElement("BUTTON", { "data-host-app-id": "internal-button" }, "Save");

    expect(dataAttributesForElement(button as unknown as Element)).toEqual({});
    expect(cssSelectorForElement(button as unknown as Element)).toBe("button");
  });

  it("keeps XPath sibling indexes as fallback receipts", () => {
    const root = makeFakeElement("HTML");
    const body = root.append(makeFakeElement("BODY"));
    body.append(makeFakeElement("BUTTON", {}, "First"));
    const second = body.append(makeFakeElement("BUTTON", {}, "Second"));

    expect(xpathForElement(second as unknown as Element)).toBe("/html/body/button[2]");
    expect(cssSelectorForElement(second as unknown as Element)).toBe(
      "html > body > button:nth-of-type(2)",
    );
  });

  it("records nearest stable anchor identity when the click lands on a child", () => {
    const card = makeFakeElement("SECTION", { "data-testid": "home-current-posture" });
    const label = card.append(makeFakeElement("SPAN", {}, "needs_attention"));

    expect(annotationIdentityForElement(label as unknown as Element)).toMatchObject({
      stableSelector: '[data-testid="home-current-posture"]',
      testId: "home-current-posture",
    });
  });

  it("recognizes annotation overlay targets so clicks do not annotate the overlay", () => {
    const overlay = makeFakeElement("DIV", { "data-live-annotation-overlay": "true" });
    const child = overlay.append(makeFakeElement("BUTTON"));

    expect(isAnnotationOverlayElement(child as unknown as EventTarget)).toBe(true);
  });

  it("keeps the floating annotation editor within the viewport while dragging", () => {
    expect(
      clampAnnotationEditorPosition(
        { x: -40, y: 900 },
        { height: 220, width: 360 },
        { height: 640, width: 1024 },
      ),
    ).toEqual({ x: 16, y: 404 });
  });

  it("persists and clamps the floating annotation editor position", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    writeStoredAnnotationEditorPosition("test-annotations", { x: 900, y: 30 });

    expect(
      readStoredAnnotationEditorPosition(
        "test-annotations",
        { height: 220, width: 360 },
        { height: 640, width: 1024 },
      ),
    ).toEqual({ x: 648, y: 30 });
  });

  it("drags the editor from the visible header surface", () => {
    const windowListeners = new Map<string, Array<(event: FakePointerEvent) => void>>();
    const body = new TestDomElement("BODY");
    const documentElement = new TestDomElement("HTML");
    const storage = new Map<string, string>();

    vi.stubGlobal("Element", TestDomElement);
    vi.stubGlobal("HTMLElement", TestDomElement);
    vi.stubGlobal("HTMLTextAreaElement", TestDomElement);
    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: (event: FakePointerEvent) => void) => {
        const listeners = windowListeners.get(type) ?? [];
        listeners.push(listener);
        windowListeners.set(type, listeners);
      },
      innerHeight: 640,
      innerWidth: 1024,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      removeEventListener: vi.fn(),
      setTimeout: (callback: () => void) => {
        callback();
        return 0;
      },
    });
    vi.stubGlobal("document", {
      body,
      createElement: (tagName: string) => new TestDomElement(tagName.toUpperCase()),
      documentElement,
      elementFromPoint: vi.fn(),
      title: "Test",
    });

    const controller = createLiveAnnotationController({ enabled: true });
    const target = new TestDomElement("SECTION");
    target.rect = {
      bottom: 180,
      height: 80,
      left: 100,
      right: 220,
      top: 100,
      width: 120,
      x: 100,
      y: 100,
    };

    for (const listener of windowListeners.get("click") ?? []) {
      listener(makePointerEvent(target, { clientX: 110, clientY: 110 }));
    }

    const editor = body.children.find((child) => child.tagName === "FORM");
    const dragHeader = editor?.querySelector<TestDomElement>("[data-live-annotation-drag-handle]");
    expect(editor?.style.left).toBe("232px");
    expect(editor?.style.top).toBe("100px");
    expect(dragHeader).toBeTruthy();

    const start = dragHeader?.dispatchPointer("pointerdown", {
      button: 0,
      clientX: 252,
      clientY: 108,
      pointerId: 7,
      target: dragHeader,
    });
    dragHeader?.dispatchPointer("pointermove", {
      button: 0,
      clientX: 292,
      clientY: 138,
      pointerId: 7,
      target: dragHeader,
    });
    dragHeader?.dispatchPointer("pointerup", {
      button: 0,
      clientX: 292,
      clientY: 138,
      pointerId: 7,
      target: dragHeader,
    });

    expect(start?.defaultPrevented).toBe(true);
    expect(editor?.style.left).toBe("272px");
    expect(editor?.style.top).toBe("130px");
    expect(storage.get("electron-live-annotations.editorPosition")).toBe(
      JSON.stringify({ x: 272, y: 130 }),
    );

    controller.destroy();
  });

  it("does not duplicate listeners when start is called repeatedly", () => {
    const { body, windowListeners } = installControllerDom();
    const controller = createLiveAnnotationController({ enabled: true });

    expect(body.children).toHaveLength(2);
    expect(windowListeners.get("click")).toHaveLength(1);
    expect(windowListeners.get("mousemove")).toHaveLength(1);

    controller.start();

    expect(body.children).toHaveLength(2);
    expect(windowListeners.get("click")).toHaveLength(1);
    expect(windowListeners.get("mousemove")).toHaveLength(1);

    controller.destroy();
  });

  it("uses custom toggle keys to enter annotation mode", () => {
    const { body, windowListeners } = installControllerDom();
    const controller = createLiveAnnotationController({ toggleKey: "k" });

    const ignored = makeKeyboardEvent(".", { metaKey: true });
    for (const listener of windowListeners.get("keydown") ?? []) {
      listener(ignored);
    }
    expect(ignored.defaultPrevented).toBe(false);
    expect(controller.isEnabled()).toBe(false);
    expect(body.children).toHaveLength(0);

    const accepted = makeKeyboardEvent("k", { metaKey: true });
    for (const listener of windowListeners.get("keydown") ?? []) {
      listener(accepted);
    }
    expect(accepted.defaultPrevented).toBe(true);
    expect(controller.isEnabled()).toBe(true);
    expect(body.children).toHaveLength(2);

    controller.destroy();
  });

  it("preserves an in-progress note on Escape and discards it on explicit cancel", () => {
    const { body, windowListeners } = installControllerDom();
    const controller = createLiveAnnotationController({ enabled: true });
    const target = new TestDomElement("SECTION");
    target.rect = {
      bottom: 180,
      height: 80,
      left: 100,
      right: 220,
      top: 100,
      width: 120,
      x: 100,
      y: 100,
    };

    for (const listener of windowListeners.get("click") ?? []) {
      listener(makePointerEvent(target, { clientX: 110, clientY: 110 }));
    }

    const editor = body.children.find((child) => child.tagName === "FORM");
    const note = editor?.querySelector<TestDomElement>("[data-live-annotation-note]");
    const cancel = editor?.querySelector<TestDomElement>("[data-live-annotation-cancel]");
    expect(editor?.style.display).toBe("block");
    if (note) {
      note.value = "Keep this draft";
    }

    const escape = makeKeyboardEvent("Escape", { target: target as unknown as EventTarget });
    for (const listener of windowListeners.get("keydown") ?? []) {
      listener(escape);
    }

    expect(escape.defaultPrevented).toBe(true);
    expect(controller.isEnabled()).toBe(true);
    expect(controller.selectedElement()).toBeNull();
    expect(editor?.style.display).toBe("none");

    for (const listener of windowListeners.get("click") ?? []) {
      listener(makePointerEvent(target, { clientX: 110, clientY: 110 }));
    }
    expect(note?.value).toBe("Keep this draft");

    if (!cancel) {
      throw new Error("Expected annotation cancel button to exist.");
    }
    for (const listener of cancel.listeners.get("click") ?? []) {
      listener(makePointerEvent(cancel, {}));
    }
    for (const listener of windowListeners.get("click") ?? []) {
      listener(makePointerEvent(target, { clientX: 110, clientY: 110 }));
    }
    expect(note?.value).toBe("");

    controller.destroy();
  });
});
