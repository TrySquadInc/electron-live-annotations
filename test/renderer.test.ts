import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  annotationIdentityForElement,
  clampAnnotationEditorPosition,
  cssSelectorForElement,
  dataAttributesForElement,
  isAnnotationOverlayElement,
  shouldToggleAnnotationModeShortcut,
  stableSelectorForElement,
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

describe("renderer annotation helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("Element", fakeElementRuntime);
    vi.stubGlobal("HTMLElement", fakeElementRuntime);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("claims Cmd+. and Ctrl+. without taking editable targets", () => {
    expect(shouldToggleAnnotationModeShortcut({ key: ".", metaKey: true })).toBe(true);
    expect(shouldToggleAnnotationModeShortcut({ key: ".", ctrlKey: true })).toBe(true);
    expect(
      shouldToggleAnnotationModeShortcut({ key: ".", metaKey: true, targetIsEditable: true }),
    ).toBe(false);
    expect(shouldToggleAnnotationModeShortcut({ key: ".", metaKey: true, shiftKey: true })).toBe(
      false,
    );
    expect(shouldToggleAnnotationModeShortcut({ key: "k", metaKey: true })).toBe(false);
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
});
