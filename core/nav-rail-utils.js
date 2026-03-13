export function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

export function getDepthClass(depth) {
  const normalized = Number.isFinite(depth) ? Math.floor(depth) : 0;
  const clamped = Math.max(0, Math.min(6, normalized));
  return "is-depth-" + String(clamped);
}
