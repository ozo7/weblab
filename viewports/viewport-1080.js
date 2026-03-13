import { createColorPicker } from "../core/color-picker.js";
import { getReadableTextColor } from "../core/color-schemes.js";

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
  const tagPool = options.tagPool || null;
  const pagingQueue = options.pagingQueue || null;
  const configuration = options.configuration || null;
  const homeArticleId = options.homeArticleId || null;

  host.innerHTML = [
    '<div class="wv1080-stage">',
    '  <div class="wv1080-layout">',
    '    <section class="wv1080-content-host" aria-label="Content viewport">',
    '      <main id="pane2main"></main>',
    '    </section>',
    '    <nav class="wv1080-rail" aria-label="Navigation rail">',
    '      <div class="wv1080-rail-head">',
    '        <div class="wv1080-rail-head-actions">',
    '          <button type="button" class="wv1080-head-btn" data-action="home" aria-label="Home">⌂ Home</button>',
    '          <button type="button" class="wv1080-head-btn" data-action="back" aria-label="Back">← Back</button>',
    '        </div>',
    '        <div class="wv1080-rail-menu-wrap">',
    '          <button type="button" class="wv1080-rail-menu-btn" aria-label="Open rail menu" aria-haspopup="true" aria-expanded="false">☰</button>',
    '          <div class="wv1080-rail-menu-list" hidden>',
    '            <button type="button" class="wv1080-rail-menu-item active" data-mode="menus">menus / sitemap</button>',
    '            <button type="button" class="wv1080-rail-menu-item" data-mode="tags">tags</button>',
    '            <button type="button" class="wv1080-rail-menu-item" data-mode="history">history</button>',
    '            <button type="button" class="wv1080-rail-menu-item" data-mode="configuration">configuration</button>',
    "          </div>",
    "        </div>",
    "      </div>",
    '      <div class="wv1080-rail-scroll">',
    '        <div id="wv1080NavTree"></div>',
    '      </div>',
    '    </nav>',
    '  </div>',
    '</div>'
  ].join("\n");

  const pane = host.querySelector("#pane2main");
  const navTreeContainer = host.querySelector("#wv1080NavTree");
  const rail = host.querySelector(".wv1080-rail");
  const railScroll = host.querySelector(".wv1080-rail-scroll");
  const headHomeButton = host.querySelector('[data-action="home"]');
  const headBackButton = host.querySelector('[data-action="back"]');
  const railMenuButton = host.querySelector(".wv1080-rail-menu-btn");
  const railMenuList = host.querySelector(".wv1080-rail-menu-list");
  const railMenuItems = Array.from(host.querySelectorAll(".wv1080-rail-menu-item"));
  let fallbackRailMode = "menus";

  function setRailMenuOpen(open) {
    const expanded = Boolean(open);
    railMenuList.hidden = !expanded;
    railMenuButton.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function setRailMode(mode) {
    const beforeState = typeof navigation.readState === "function" ? navigation.readState() : null;
    const previousMode = beforeState && typeof beforeState.navArea === "string" ? beforeState.navArea : null;
    const next = mode === "tags" || mode === "history" || mode === "menus" || mode === "configuration" ? mode : "menus";
    if (typeof navigation.setNavArea === "function") {
      navigation.setNavArea(next);
    } else {
      fallbackRailMode = next;
    }
    const navState = navigation.readState();
    const railMode = navState.navArea === "tags" || navState.navArea === "history" || navState.navArea === "configuration"
      ? navState.navArea
      : fallbackRailMode;
    railMenuItems.forEach((item) => {
      item.classList.toggle("active", item.getAttribute("data-mode") === railMode);
    });
    if (previousMode === "configuration" && next !== "configuration") {
      const currentId = navigation.readState().selectedArticleId;
      if (currentId && typeof navigation.openArticleById === "function") {
        navigation.openArticleById(currentId);
      }
    }
    setRailMenuOpen(false);
    render();
  }

  function renderConfigurationPreviewIntoPane() {
    if (!configuration || typeof configuration.getSelectedScheme !== "function") {
      return;
    }
    const selected = configuration.getSelectedScheme();
    if (!selected || !selected.preview) {
      return;
    }
    const preview = selected.preview;
    const accentText = getReadableTextColor(preview.accent || "#888888");
    const interactiveText = getReadableTextColor(preview.interactive || "#888888");
    const interactiveAltText = getReadableTextColor(preview.placeholder || "#888888");
    const safe = (value, fallback) => (typeof value === "string" && value ? value : fallback);
    pane.className = "wv1080-config-preview-pane";
    pane.style.background = safe(preview.surface, "#F8FCF8");
    pane.innerHTML = [
      '<div class="wv1080-config-preview-stage">',
      '  <div class="wv1080-config-preview-card" style="background:' + safe(preview.surface, "#F8FCF8") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">',
      '    <div class="wv1080-config-preview-top">',
      '      <span class="wv1080-config-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">menus / sitemap</span>',
      '      <span class="wv1080-config-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">☰</span>',
      "    </div>",
      '    <div class="wv1080-config-preview-title">Theme Illustration: ' + selected.label + "</div>",
      '    <div class="wv1080-config-preview-queue" style="background:' + safe(preview.layer, "#FFFFFF") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">',
      '      <div class="wv1080-config-preview-qrow" style="border-color:' + safe(preview.border, "#B8CABC") + ';">',
      "        <span>hh-home</span>",
      '        <span class="wv1080-config-preview-stripe" style="background:' + safe(preview.accent, "#1E88E5") + ';"></span>',
      "      </div>",
      '      <div class="wv1080-config-preview-qrow" style="border-color:' + safe(preview.border, "#B8CABC") + ';">',
      "        <span>hh-seminare</span>",
      '        <span class="wv1080-config-preview-stripes"><i style="background:' + safe(preview.accent, "#1E88E5") + ';"></i><i style="background:' + safe(preview.interactive, "#E5F1E8") + ';"></i></span>',
      "      </div>",
      '      <div class="wv1080-config-preview-qrow">',
      "        <span>hh-kontakt</span>",
      '        <span class="wv1080-config-preview-stripe" style="background:' + safe(preview.accent, "#1E88E5") + ';"></span>',
      "      </div>",
      "    </div>",
      '    <div class="wv1080-config-preview-controls">',
      '      <span class="wv1080-config-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">&lt;</span>',
      '      <span class="wv1080-config-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">&gt;</span>',
      "      <span>Selected: 3</span>",
      '      <span class="wv1080-config-preview-btn" style="margin-left:auto;background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + interactiveAltText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Clear</span>',
      "    </div>",
      '    <div class="wv1080-config-preview-tags">',
      '      <span class="wv1080-config-preview-tag active" style="background:' + safe(preview.accent, "#1E88E5") + ";color:" + accentText + ';">Seminare</span>',
      '      <span class="wv1080-config-preview-tag active" style="background:' + safe(preview.accent, "#1E88E5") + ";color:" + accentText + ';">Kontakt</span>',
      '      <span class="wv1080-config-preview-tag" style="background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Audio</span>',
      "    </div>",
      '    <div class="wv1080-config-preview-placeholder" style="background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Configuration preview only (no app behavior yet).</div>',
      "  </div>",
      "</div>"
    ].join("\n");
  }

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

    return row;
  }

  function render() {
    const runtime = navigation.readState();
    const historyList = Array.isArray(runtime.navigationHistory) ? runtime.navigationHistory : [];
    headBackButton.disabled = historyList.length === 0;

    const railMode = runtime.navArea === "tags" || runtime.navArea === "history" || runtime.navArea === "configuration"
      ? runtime.navArea
      : fallbackRailMode;
    railMenuItems.forEach((item) => {
      item.classList.toggle("active", item.getAttribute("data-mode") === railMode);
    });
    railScroll.innerHTML = "";
    if (railMode === "tags") {
      const wrap = document.createElement("div");
      wrap.className = "wv1080-tags-pane";

      const head = document.createElement("div");
      head.className = "wv1080-history-head";
      head.textContent = "Pages to read, selected by tags:";
      wrap.appendChild(head);

      const queue = pagingQueue && typeof pagingQueue.getQueue === "function"
        ? pagingQueue.getQueue()
        : [];
      const selectedTagColors = tagPool && typeof tagPool.getSelectedTagColors === "function"
        ? tagPool.getSelectedTagColors()
        : {};
      const selectedId = runtime.selectedArticleId;
      const currentIndex = queue.indexOf(selectedId);
      const hasCurrentInQueue = currentIndex >= 0;
      const queueList = document.createElement("div");
      queueList.className = "wv1080-history-list wv1080-tags-queue-list";
      if (!queue.length) {
        const empty = document.createElement("div");
        empty.className = "wv1080-history-empty";
        empty.textContent = "No selected pages.";
        queueList.appendChild(empty);
      } else {
        queue.forEach((articleId) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "wv1080-history-item" + (articleId === selectedId ? " active" : "");
          item.addEventListener("click", () => navigation.openArticleById(articleId));

          const selectedTagsFromPool = tagPool && typeof tagPool.getSelectedTagsForArticle === "function"
            ? tagPool.getSelectedTagsForArticle(articleId)
            : [];
          const label = document.createElement("span");
          label.className = "wv1080-queue-label";
          label.textContent = articleId;
          item.appendChild(label);

          const stripeWrap = document.createElement("span");
          stripeWrap.className = "wv1080-queue-stripes";
          selectedTagsFromPool.forEach((tag) => {
            const stripe = document.createElement("span");
            stripe.className = "wv1080-queue-stripe";
            stripe.style.backgroundColor = selectedTagColors[tag] || "#111111";
            stripe.title = tag;
            stripeWrap.appendChild(stripe);
          });
          item.appendChild(stripeWrap);
          queueList.appendChild(item);
        });
      }
      wrap.appendChild(queueList);

      const controls = document.createElement("div");
      controls.className = "wv1080-tags-controls";
      const prevId = hasCurrentInQueue && currentIndex > 0 ? queue[currentIndex - 1] : null;
      const nextId = hasCurrentInQueue
        ? (currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null)
        : (queue.length ? queue[0] : null);

      const prevButton = createButton("<", "wv1080-tags-nav-btn", () => {
        if (prevId) {
          navigation.openArticleById(prevId);
        }
      });
      prevButton.disabled = !prevId;
      controls.appendChild(prevButton);

      const nextButton = createButton(">", "wv1080-tags-nav-btn", () => {
        if (nextId) {
          navigation.openArticleById(nextId);
        }
      });
      nextButton.disabled = !nextId;
      controls.appendChild(nextButton);

      const selectedCount = document.createElement("div");
      selectedCount.className = "wv1080-tags-selected";
      selectedCount.textContent = "Selected: " + queue.length;
      controls.appendChild(selectedCount);

      const selectedTags = new Set(
        tagPool && typeof tagPool.getSelectedTags === "function"
          ? tagPool.getSelectedTags()
          : []
      );
      const clearTags = createButton("Clear", "wv1080-tag-clear wv1080-tag-clear-inline", () => {
        if (tagPool && typeof tagPool.clear === "function") {
          tagPool.clear();
        }
      });
      clearTags.disabled = selectedTags.size === 0;
      controls.appendChild(clearTags);
      wrap.appendChild(controls);

      const tagWrap = document.createElement("div");
      tagWrap.className = "wv1080-tagpool";
      const tagHead = document.createElement("div");
      tagHead.className = "wv1080-tagpool-head";
      tagHead.textContent = "Tag pool:";
      tagWrap.appendChild(tagHead);

      const tags = tagPool && typeof tagPool.getAllTags === "function"
        ? tagPool.getAllTags()
        : [];
      const tagList = document.createElement("div");
      tagList.className = "wv1080-tagpool-list";
      tags.forEach((tag) => {
        const color = selectedTagColors[tag];
        const tagButton = createButton(
          tag,
          "wv1080-tag-btn" + (selectedTags.has(tag) ? " active" : ""),
          () => {
            if (tagPool && typeof tagPool.toggleTag === "function") {
              tagPool.toggleTag(tag);
            }
          }
        );
        if (color && selectedTags.has(tag)) {
          tagButton.style.borderColor = color;
          tagButton.style.backgroundColor = color;
          tagButton.style.color = getReadableTextColor(color);
        }
        tagList.appendChild(tagButton);
      });
      tagWrap.appendChild(tagList);

      wrap.appendChild(tagWrap);
      railScroll.appendChild(wrap);
      return;
    }
    if (railMode === "history") {
      const wrap = document.createElement("div");
      wrap.className = "wv1080-history";

      const head = document.createElement("div");
      head.className = "wv1080-history-head";
      head.textContent = "Your last visited pages (max. 20):";
      wrap.appendChild(head);

      const historyList = Array.isArray(runtime.navigationHistory) ? runtime.navigationHistory : [];
      if (!historyList.length) {
        const empty = document.createElement("div");
        empty.className = "wv1080-history-empty";
        empty.textContent = "No visited pages yet.";
        wrap.appendChild(empty);
      } else {
        const list = document.createElement("div");
        list.className = "wv1080-history-list";
        historyList.forEach((articleId, index) => {
          const item = createButton(
            String(index + 1) + ". " + articleId,
            "wv1080-history-item",
            () => navigation.openArticleById(articleId)
          );
          list.appendChild(item);
        });
        wrap.appendChild(list);
      }

      railScroll.appendChild(wrap);
      return;
    }
    if (railMode === "configuration") {
      renderConfigurationPreviewIntoPane();
      const wrap = document.createElement("div");
      wrap.className = "wv1080-config-panel";

      const sectionTitle = document.createElement("div");
      sectionTitle.className = "wv1080-history-head";
      sectionTitle.textContent = "Configuration";
      wrap.appendChild(sectionTitle);

      const state = configuration && typeof configuration.readState === "function"
        ? configuration.readState()
        : null;
      const toggle = createButton(
        "Color Schemes",
        "wv1080-config-toggle",
        () => {
          if (configuration && typeof configuration.toggleColorSchemesVisible === "function") {
            configuration.toggleColorSchemesVisible();
          }
        }
      );
      wrap.appendChild(toggle);

      const visible = Boolean(state && state.colorSchemesVisible);
      if (visible) {
        const schemeList = document.createElement("div");
        schemeList.className = "wv1080-config-scheme-list";
        const schemes = state && Array.isArray(state.schemes) ? state.schemes : [];
        const selectedKey = state && typeof state.selectedSchemeKey === "string" ? state.selectedSchemeKey : "";
        schemes.forEach((scheme) => {
          const preview = scheme && scheme.preview ? scheme.preview : {};
          const button = document.createElement("button");
          button.type = "button";
          button.className = "wv1080-config-scheme-btn" + (selectedKey === scheme.key ? " active" : "");
          button.textContent = scheme.label;
          button.style.background = preview.interactive || "#E5F1E8";
          button.style.color = getReadableTextColor(preview.interactive || "#E5F1E8");
          button.style.borderColor = preview.border || "#B8CABC";
          button.addEventListener("click", () => {
            if (configuration && typeof configuration.setSelectedScheme === "function") {
              configuration.setSelectedScheme(scheme.key);
            }
          });
          schemeList.appendChild(button);
        });
        wrap.appendChild(schemeList);

        const pastelRow = document.createElement("div");
        pastelRow.className = "wv1080-config-pastel-row";
        const pastelLabel = document.createElement("label");
        pastelLabel.className = "wv1080-config-pastel-label";
        pastelLabel.textContent = "Pastel base:";
        pastelRow.appendChild(pastelLabel);
        const initialHex = state && typeof state.pastelBaseColor === "string" ? state.pastelBaseColor : "#B76DC9";
        const pickerHost = document.createElement("div");
        pastelRow.appendChild(pickerHost);
        createColorPicker({
          host: pickerHost,
          initialHex,
          onChange(nextHex) {
            if (configuration && typeof configuration.setPastelBaseColor === "function") {
              configuration.setPastelBaseColor(nextHex);
            }
          }
        });
        wrap.appendChild(pastelRow);
      }

      railScroll.appendChild(wrap);
      return;
    }

    railScroll.appendChild(navTreeContainer);
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
  const unsubscribeTagPool = tagPool && typeof tagPool.subscribe === "function"
    ? tagPool.subscribe(() => render())
    : () => {};
  const unsubscribePagingQueue = pagingQueue && typeof pagingQueue.subscribe === "function"
    ? pagingQueue.subscribe(() => render())
    : () => {};
  const unsubscribeConfiguration = configuration && typeof configuration.subscribe === "function"
    ? configuration.subscribe((event) => {
      if (navigation.readState().navArea !== "configuration") {
        return;
      }
      if (event && event.type === "set-pastel-base-color") {
        renderConfigurationPreviewIntoPane();
        return;
      }
      render();
    })
    : () => {};

  railMenuButton.addEventListener("click", () => {
    setRailMenuOpen(railMenuList.hidden);
  });
  railMenuItems.forEach((item) => {
    item.addEventListener("click", () => {
      setRailMode(item.getAttribute("data-mode") || "menus");
    });
  });
  headHomeButton.addEventListener("click", () => {
    if (navigation.readState().navArea === "configuration") {
      setRailMode("menus");
    }
    if (homeArticleId) {
      navigation.openArticleById(homeArticleId);
      return;
    }
    navigation.openHome();
  });
  headBackButton.addEventListener("click", () => {
    if (navigation.readState().navArea === "configuration") {
      setRailMode("menus");
    }
    navigation.goBack();
  });
  const onDocumentClick = (event) => {
    if (!(event.target instanceof Node) || !host.contains(event.target)) {
      setRailMenuOpen(false);
      return;
    }
    const wrap = host.querySelector(".wv1080-rail-menu-wrap");
    if (wrap && !wrap.contains(event.target)) {
      setRailMenuOpen(false);
    }
  };
  document.addEventListener("click", onDocumentClick);

  setRailMode(navigation.readState().navArea || "menus");

  return {
    key: "1080",
    articlePane: pane,
    teardown() {
      unsubscribe();
      unsubscribeTagPool();
      unsubscribePagingQueue();
      unsubscribeConfiguration();
      document.removeEventListener("click", onDocumentClick);
      host.innerHTML = "";
    }
  };
}
