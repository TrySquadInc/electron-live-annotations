import { createLiveAnnotationController } from "electron-live-annotations/renderer";

const annotations = createLiveAnnotationController({
  stableAttributeNames: ["data-testid", "data-product-id"],
  stableAttributePrefixes: ["data-product-"],
  onSaved(result) {
    console.log("Saved annotation", result.manifest.manifestJsonlPath);
  },
});

document.querySelector("[data-testid='toggle-annotations']")?.addEventListener("click", () => {
  annotations.toggle();
});
