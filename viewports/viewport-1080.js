function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function parseColorChannels(color) {
  const match = color && color.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }
  const values = match[1].split(",").slice(0, 3).map((value) => Number(value.trim()));
  if (values.length !== 3 || values.some((value) => Number.isNaN(value))) {
    return null;
  }
  return values;
}

function mixChannels(base, target, amount) {
  return [
    Math.round(base[0] + (target[0] - base[0]) * amount),
    Math.round(base[1] + (target[1] - base[1]) * amount),
    Math.round(base[2] + (target[2] - base[2]) * amount)
  ];
}

function relativeLuminance(channels) {
  const linear = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function computeDepthBackground(rail, depth) {
  if (depth <= 0) {
    return "";
  }
  const fallback = [248, 252, 248];
  const channels = parseColorChannels(getComputedStyle(rail).backgroundColor) || fallback;
  const isLight = relativeLuminance(channels) >= 0.5;
  const target = isLight ? [0, 0, 0] : [255, 255, 255];
  const amount = Math.min(depth * 0.08, 0.28);
  const mixed = mixChannels(channels, target, amount);
  return "rgb(" + mixed.join(", ") + ")";
}

export function createViewport1080(options) {
  const host = options.host;
  const navigation = options.navigation;
  const siteMap = options.siteMap;
  const homeArticleId = options.homeArticleId || null;

  host.innerHTML = [
    '<div class="wv1080-stage">',
    '  <div class="wv1080-layout">',
    '    <section class="wv1080-content-host" aria-label="Content viewport">',
    '      <main id="pane2main"></main>',
    '    </section>',
    '    <nav class="wv1080-rail" aria-label="Navigation rail">',
    '      <div class="wv1080-rail-scroll">',
    '        <div id="wv1080NavTree"></div>',
    '      </div>',
    '      <div class="wv1080-rail-footer">',
    '        <button type="button" class="wv1080-tab" disabled>Pages</button>',
    '        <button type="button" class="wv1080-tab" disabled>Tags (inactive)</button>',
    '      </div>',
    '    </nav>',
    '  </div>',
    '</div>'
  ].join("\n");

  const pane = host.querySelector("#pane2main");
  const navTreeContainer = host.querySelector("#wv1080NavTree");
  const rail = host.querySelector(".wv1080-rail");

  function getNodeTitle(node) {
    if (typeof node.title === "string" && node.title.trim()) {
      return node.title.trim();
    }
    if (typeof node.label === "string" && node.label.trim()) {
      return node.label.trim();
    }
    return typeof node.articleId === "string" && node.articleId ? node.articleId : "Menu";
  }

  function createMenuRow(node) {
    const row = document.createElement("div");
    row.className = "wv1080-nav-row wv1080-menu-row";
    row.style.paddingLeft = node.depth * 10 + "px";
    const background = computeDepthBackground(rail, node.depth);
    if (background) {
      row.style.backgroundColor = background;
    }

    if (node.hasChildren) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "wv1080-menu-toggle";
      toggle.textContent = node.isExpanded ? "-" : "+";
      toggle.setAttribute("aria-label", node.isExpanded ? "Collapse section" : "Expand section");
      toggle.setAttribute("aria-expanded", node.isExpanded ? "true" : "false");
      toggle.addEventListener("click", () => {
        siteMap.toggleNode(node.nodeId);
        render();
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "wv1080-menu-toggle-spacer";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    if (node.isClickable) {
      const button = createButton(
        getNodeTitle(node),
        "wv1080-nav-btn" + (node.isActive ? " active" : ""),
        () => {
          const articleId = siteMap.openNode(node.nodeId);
          if (articleId) {
            navigation.openArticleById(articleId);
          }
        }
      );
      row.appendChild(button);
    } else {
      const label = document.createElement("div");
      label.className = "wv1080-menu-label";
      label.textContent = getNodeTitle(node);
      row.appendChild(label);
    }

    return row;
  }

  function createArticleRow(node) {
    const isHomeRow = Boolean(homeArticleId) && node.depth === 0 && node.articleId === homeArticleId;
    const row = document.createElement("div");
    row.className = "wv1080-nav-row wv1080-article-row" + (isHomeRow ? " wv1080-home-nav-row" : "");
    row.style.paddingLeft = node.depth * 10 + "px";
    const background = computeDepthBackground(rail, node.depth);
    if (background) {
      row.style.backgroundColor = background;
    }

    const spacer = document.createElement("span");
    spacer.className = "wv1080-menu-toggle-spacer";
    spacer.setAttribute("aria-hidden", "true");
    row.appendChild(spacer);

    const button = createButton(
      (isHomeRow ? "⌂ " : "") + getNodeTitle(node),
      "wv1080-nav-btn" + (node.isActive ? " active" : ""),
      () => {
        const articleId = siteMap.openNode(node.nodeId);
        if (articleId) {
          navigation.openArticleById(articleId);
        }
      }
    );
    row.appendChild(button);

    if (isHomeRow) {
      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.className = "wv1080-back-btn wv1080-back-inline";
      backButton.textContent = "←";
      backButton.setAttribute("aria-label", "Back");
      backButton.disabled = navigation.readState().articleHistory.length === 0;
      backButton.addEventListener("click", () => navigation.goBack());
      row.appendChild(backButton);
    }

    return row;
  }

  function render() {
    const runtime = navigation.readState();
    const tree = siteMap.getTreeModel(runtime.selectedArticleId);
    navTreeContainer.innerHTML = "";
    tree.forEach((node) => {
      if (node.type === "menu") {
        navTreeContainer.appendChild(createMenuRow(node));
        return;
      }
      if (node.type === "article") {
        navTreeContainer.appendChild(createArticleRow(node));
      }
    });
  }

  const unsubscribe = navigation.subscribe((event) => {
    if (event.type === "open" || event.type === "back-empty") {
      render();
    }
  });

  render();

  return {
    key: "1080",
    articlePane: pane,
    teardown() {
      unsubscribe();
      host.innerHTML = "";
    }
  };
}
