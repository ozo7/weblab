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
  const navTreeCore = options.navTree;
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

  function createMenuRow(model) {
    const row = document.createElement("div");
    row.className = "wv1080-nav-row wv1080-menu-row";
    row.style.paddingLeft = model.depth * 10 + "px";
    const background = computeDepthBackground(rail, model.depth);
    if (background) {
      row.style.backgroundColor = background;
    }

    if (model.hasChildren) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "wv1080-menu-toggle";
      toggle.textContent = model.expanded ? "-" : "+";
      toggle.setAttribute("aria-label", model.expanded ? "Collapse section" : "Expand section");
      toggle.setAttribute("aria-expanded", model.expanded ? "true" : "false");
      toggle.addEventListener("click", () => {
        model.onToggle();
        render();
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "wv1080-menu-toggle-spacer";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    if (model.canOpenArticle) {
      const button = createButton(
        typeof model.entry.title === "string" && model.entry.title.trim()
          ? model.entry.title.trim()
          : (typeof model.entry.label === "string" && model.entry.label.trim() ? model.entry.label.trim() : model.entry.articleId),
        "wv1080-nav-btn" + (model.active ? " active" : ""),
        model.onOpen
      );
      row.appendChild(button);
    } else {
      const label = document.createElement("div");
      label.className = "wv1080-menu-label";
      label.textContent = typeof model.entry.label === "string" && model.entry.label.trim() ? model.entry.label.trim() : "Menu";
      row.appendChild(label);
    }

    return row;
  }

  function createArticleRow(model) {
    const isHomeRow = Boolean(homeArticleId) && model.depth === 0 && model.entry.articleId === homeArticleId;
    const row = document.createElement("div");
    row.className = "wv1080-nav-row wv1080-article-row" + (isHomeRow ? " wv1080-home-nav-row" : "");
    row.style.paddingLeft = model.depth * 10 + "px";
    const background = computeDepthBackground(rail, model.depth);
    if (background) {
      row.style.backgroundColor = background;
    }

    const spacer = document.createElement("span");
    spacer.className = "wv1080-menu-toggle-spacer";
    spacer.setAttribute("aria-hidden", "true");
    row.appendChild(spacer);

    const button = createButton(
      (isHomeRow ? "⌂ " : "") + (typeof model.entry.title === "string" && model.entry.title.trim()
        ? model.entry.title.trim()
        : (typeof model.entry.label === "string" && model.entry.label.trim() ? model.entry.label.trim() : model.entry.articleId)),
      "wv1080-nav-btn" + (model.active ? " active" : ""),
      model.onOpen
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
    navTreeCore.render(navTreeContainer, {
      selectedArticleId: runtime.selectedArticleId,
      onOpenArticle(articleId) {
        navigation.openArticleById(articleId);
      },
      renderMenu: createMenuRow,
      renderArticle: createArticleRow
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
