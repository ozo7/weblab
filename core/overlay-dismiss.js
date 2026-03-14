export function bindOutsideDismiss(options) {
  const root = options && options.root;
  if (!root || typeof document === "undefined" || typeof document.addEventListener !== "function") {
    return () => {};
  }

  const isEnabled = typeof options.isEnabled === "function" ? options.isEnabled : () => true;
  const isInside = typeof options.isInside === "function"
    ? options.isInside
    : (_event, path) => Array.isArray(path) && path.includes(root);
  const onDismiss = typeof options.onDismiss === "function" ? options.onDismiss : () => {};

  const onDocumentClick = (event) => {
    if (!isEnabled()) {
      return;
    }
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (isInside(event, path)) {
      return;
    }
    onDismiss(event);
  };

  document.addEventListener("click", onDocumentClick);
  return () => {
    document.removeEventListener("click", onDocumentClick);
  };
}
