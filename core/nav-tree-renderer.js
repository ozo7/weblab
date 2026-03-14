export function renderTreeRows(options) {
  const container = options && options.container;
  const tree = Array.isArray(options && options.tree) ? options.tree : [];
  const createMenuRow = options && options.createMenuRow;
  const createArticleRow = options && options.createArticleRow;
  if (!container) {
    return;
  }
  container.innerHTML = "";
  tree.forEach((node) => {
    if (node && node.type === "menu" && typeof createMenuRow === "function") {
      container.appendChild(createMenuRow(node));
      return;
    }
    if (node && node.type === "article" && typeof createArticleRow === "function") {
      container.appendChild(createArticleRow(node));
    }
  });
}
