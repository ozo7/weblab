export function resolveNodeTitle(node) {
  if (node && typeof node.title === "string" && node.title.trim()) {
    return node.title.trim();
  }
  if (node && typeof node.label === "string" && node.label.trim()) {
    return node.label.trim();
  }
  if (node && typeof node.articleId === "string" && node.articleId) {
    return node.articleId;
  }
  return "Menu";
}
