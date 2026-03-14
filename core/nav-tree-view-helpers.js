export function resolveNodeTitle(node) {
  const prefix = node && node.publish === false ? "⛔ " : "";
  if (node && typeof node.title === "string" && node.title.trim()) {
    return prefix + node.title.trim();
  }
  if (node && typeof node.label === "string" && node.label.trim()) {
    return prefix + node.label.trim();
  }
  if (node && typeof node.articleId === "string" && node.articleId) {
    return prefix + node.articleId;
  }
  return prefix + "Menu";
}
