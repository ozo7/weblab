export function createHistoryScreen(options) {
  const root = document.createElement("div");
  root.className = typeof options.wrapClassName === "string" ? options.wrapClassName : "";

  const headerText = typeof options.headerText === "string" ? options.headerText : "";
  if (headerText) {
    const head = document.createElement("div");
    head.className = typeof options.headClassName === "string" ? options.headClassName : "";
    head.textContent = headerText;
    root.appendChild(head);
  }

  const historyIds = Array.isArray(options.historyIds) ? options.historyIds : [];
  if (!historyIds.length) {
    const empty = document.createElement("div");
    empty.className = typeof options.emptyClassName === "string" ? options.emptyClassName : "";
    empty.textContent = typeof options.emptyText === "string" ? options.emptyText : "No visited pages yet.";
    root.appendChild(empty);
    return root;
  }

  const list = document.createElement("div");
  list.className = typeof options.listClassName === "string" ? options.listClassName : "";
  const createButton = options.createButton;
  const onOpenArticle = typeof options.onOpenArticle === "function" ? options.onOpenArticle : () => {};
  historyIds.forEach((articleId, index) => {
    const label = typeof options.itemLabel === "function"
      ? options.itemLabel(articleId, index)
      : String(index + 1) + ". " + articleId;
    const button = createButton(
      label,
      typeof options.itemClassName === "string" ? options.itemClassName : "",
      () => onOpenArticle(articleId)
    );
    list.appendChild(button);
  });

  root.appendChild(list);
  return root;
}
