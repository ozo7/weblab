function waitForStylesheetNode(node, timeoutMs) {
  if (!node) {
    return Promise.resolve();
  }
  if (node.sheet) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      node.removeEventListener("load", onLoad);
      node.removeEventListener("error", onError);
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const onLoad = () => finish();
    const onError = () => finish(new Error("Failed to load stylesheet: " + (node.getAttribute("href") || "")));
    const timer = setTimeout(() => finish(), timeoutMs);

    node.addEventListener("load", onLoad, { once: true });
    node.addEventListener("error", onError, { once: true });
  });
}

export async function ensureStyleLoaded(state, href, options) {
  const timeoutMs = Number(options && options.timeoutMs) > 0 ? Number(options.timeoutMs) : 3000;
  const owner = state || {};
  const activeNode = owner.activeStyleNode || null;
  if (activeNode && activeNode.getAttribute("href") === href) {
    await waitForStylesheetNode(activeNode, timeoutMs);
    return activeNode;
  }

  if (activeNode && activeNode.parentNode) {
    activeNode.parentNode.removeChild(activeNode);
  }

  const node = document.createElement("link");
  node.rel = "stylesheet";
  node.href = href;
  document.head.appendChild(node);
  owner.activeStyleNode = node;
  await waitForStylesheetNode(node, timeoutMs);
  return node;
}
