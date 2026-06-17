// src/shared/types.ts
var defaultAnnotationCaptureIpcChannel = "electron-live-annotations:capture-element";
var annotationSchemaVersion = 1;
var defaultAnnotationVerdicts = [
  "note",
  "approved",
  "confusing",
  "bug",
  "copy",
  "design",
  "blocked",
  "needs-product-decision"
];

export {
  defaultAnnotationCaptureIpcChannel,
  annotationSchemaVersion,
  defaultAnnotationVerdicts
};
