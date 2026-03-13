import { createColorPicker } from "../core/color-picker.js";
import { getReadableTextColor } from "../core/color-schemes.js";
import { createButton, getDepthClass } from "../core/nav-rail-utils.js";

export function createViewport720(options) {
  const host = options.host;
  const navigation = options.navigation;
  const siteMap = options.siteMap;
  const tagPool = options.tagPool || null;
  const pagingQueue = options.pagingQueue || null;
  const configuration = options.configuration || null;
  const settingsStore = options.settingsStore;
  const articleMap = options.articleMap instanceof Map ? options.articleMap : new Map();
  const homeArticleId = options.homeArticleId || null;

  const fallbackArticleId = homeArticleId && articleMap.has(homeArticleId)
    ? homeArticleId
    : (navigation.readState().landingArticleId || null);

  const defaultSession = {
    railOpen: false,
    currentArticleId: fallbackArticleId
  };
  const session = settingsStore.getViewportSession("720", defaultSession);
  let railOpen = session.railOpen === true;

  host.innerHTML = [
    '<div class="wv720-shell cs-shell" data-rail="closed">',
    '  <section class="wv720-content-host cs-content-host" aria-label="Content viewport">',
    '    <main id="pane2main"></main>',
    "  </section>",
    '  <aside class="wv720-rail" aria-label="Sidebar">',
    '    <button type="button" class="wv720-rail-toggle" aria-label="Toggle sidebar"></button>',
    '    <div class="wv720-rail-panel">',
    '      <nav class="wv720-nav-rail wv720-shared-rail cs-rail" aria-label="Navigation rail">',
    '        <div class="wv720-nav-rail-head cs-rail-head">',
    '          <div class="wv720-nav-rail-head-actions">',
    '            <button type="button" class="wv720-head-btn cs-head-btn" data-action="home" aria-label="Home"><span class="cs-head-icon" aria-hidden="true">⌂</span><span>Home</span></button>',
    '            <button type="button" class="wv720-head-btn cs-head-btn" data-action="back" aria-label="Back"><span class="cs-head-icon" aria-hidden="true">←</span><span>Back</span></button>',
    "          </div>",
    '          <div class="wv720-nav-rail-menu-wrap">',
    '            <button type="button" class="wv720-nav-rail-menu-btn cs-menu-trigger" aria-label="Open rail menu" aria-haspopup="true" aria-expanded="false">☰</button>',
    '            <div class="wv720-nav-rail-menu-list cs-menu-list" hidden>',
    '              <button type="button" class="wv720-nav-rail-menu-item cs-menu-item active" data-mode="menus">menus / sitemap</button>',
    '              <button type="button" class="wv720-nav-rail-menu-item cs-menu-item" data-mode="tags">tags</button>',
    '              <button type="button" class="wv720-nav-rail-menu-item cs-menu-item" data-mode="history">history</button>',
    '              <button type="button" class="wv720-nav-rail-menu-item cs-menu-item" data-mode="configuration">configuration</button>',
    "            </div>",
    "          </div>",
    "        </div>",
    '        <div class="wv720-nav-rail-scroll">',
    '          <div id="wv720NavTree"></div>',
    "        </div>",
    "      </nav>",
    "    </div>",
    "  </aside>",
    "</div>"
  ].join("\n");

  const shell = host.querySelector(".wv720-shell");
  const pane = host.querySelector("#pane2main");
  const railToggleButton = host.querySelector(".wv720-rail-toggle");
  const railPanel = host.querySelector(".wv720-rail-panel");
  const railScroll = host.querySelector(".wv720-nav-rail-scroll");
  const navTreeContainer = host.querySelector("#wv720NavTree");
  const headHomeButton = host.querySelector('[data-action="home"]');
  const headBackButton = host.querySelector('[data-action="back"]');
  const railMenuButton = host.querySelector(".wv720-nav-rail-menu-btn");
  const railMenuList = host.querySelector(".wv720-nav-rail-menu-list");
  const railMenuItems = Array.from(host.querySelectorAll(".wv720-nav-rail-menu-item"));

  function persistSession() {
    settingsStore.setViewportSession("720", {
      railOpen,
      currentArticleId: navigation.readState().selectedArticleId || fallbackArticleId
    });
    settingsStore.schedulePersist(120);
  }

  function setRailOpen(open) {
    railOpen = Boolean(open);
    shell.dataset.rail = railOpen ? "open" : "closed";
    railPanel.setAttribute("aria-hidden", railOpen ? "false" : "true");
    railToggleButton.setAttribute("aria-label", railOpen ? "Close sidebar" : "Open sidebar");
    persistSession();
  }

  function setRailMenuOpen(open) {
    const expanded = Boolean(open);
    railMenuList.hidden = !expanded;
    railMenuButton.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function setRailMode(mode) {
    const previousMode = navigation.readState().navArea;
    const next = mode === "tags" || mode === "history" || mode === "menus" || mode === "configuration" ? mode : "menus";
    navigation.setNavArea(next);
    const navState = navigation.readState();
    const railMode = navState.navArea === "tags" || navState.navArea === "history" || navState.navArea === "configuration"
      ? navState.navArea
      : "menus";
    railMenuItems.forEach((item) => {
      item.classList.toggle("active", item.getAttribute("data-mode") === railMode);
    });
    if (previousMode === "configuration" && next !== "configuration") {
      const currentId = navigation.readState().selectedArticleId;
      if (currentId) {
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
    pane.className = "wv720-config-preview-pane";
    pane.style.background = safe(preview.surface, "#F8FCF8");
    pane.innerHTML = [
      '<div class="wv720-config-preview-stage">',
      '  <div class="wv720-config-preview-card cs-preview-card" style="background:' + safe(preview.surface, "#F8FCF8") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">',
      '    <div class="wv720-config-preview-top">',
      '      <span class="wv720-config-preview-btn cs-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">menus / sitemap</span>',
      '      <span class="wv720-config-preview-btn cs-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">☰</span>',
      "    </div>",
      '    <div class="wv720-config-preview-title">Theme Illustration: ' + selected.label + "</div>",
      '    <div class="wv720-config-preview-queue cs-preview-queue" style="background:' + safe(preview.layer, "#FFFFFF") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">',
      '      <div class="wv720-config-preview-qrow cs-preview-qrow" style="border-color:' + safe(preview.border, "#B8CABC") + ';">',
      "        <span>hh-home</span>",
      '        <span class="wv720-config-preview-stripe" style="background:' + safe(preview.accent, "#1E88E5") + ';"></span>',
      "      </div>",
      '      <div class="wv720-config-preview-qrow cs-preview-qrow" style="border-color:' + safe(preview.border, "#B8CABC") + ';">',
      "        <span>hh-seminare</span>",
      '        <span class="wv720-config-preview-stripes"><i style="background:' + safe(preview.accent, "#1E88E5") + ';"></i><i style="background:' + safe(preview.interactive, "#E5F1E8") + ';"></i></span>',
      "      </div>",
      '      <div class="wv720-config-preview-qrow cs-preview-qrow">',
      "        <span>hh-kontakt</span>",
      '        <span class="wv720-config-preview-stripe" style="background:' + safe(preview.accent, "#1E88E5") + ';"></span>',
      "      </div>",
      "    </div>",
      '    <div class="wv720-config-preview-controls">',
      '      <span class="wv720-config-preview-btn cs-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">&lt;</span>',
      '      <span class="wv720-config-preview-btn cs-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">&gt;</span>',
      "      <span>Selected: 3</span>",
      '      <span class="wv720-config-preview-btn cs-preview-btn" style="margin-left:auto;background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + interactiveAltText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Clear</span>',
      "    </div>",
      '    <div class="wv720-config-preview-tags">',
      '      <span class="wv720-config-preview-tag cs-preview-tag active" style="background:' + safe(preview.accent, "#1E88E5") + ";color:" + accentText + ';">Seminare</span>',
      '      <span class="wv720-config-preview-tag cs-preview-tag active" style="background:' + safe(preview.accent, "#1E88E5") + ";color:" + accentText + ';">Kontakt</span>',
      '      <span class="wv720-config-preview-tag cs-preview-tag" style="background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Audio</span>',
      "    </div>",
      '    <div class="wv720-config-preview-placeholder cs-preview-placeholder" style="background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Configuration preview only (no app behavior yet).</div>',
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
    row.className = "cs-nav-row wv720-nav-row wv720-menu-row " + getDepthClass(node.depth);
    row.style.paddingLeft = node.depth * 10 + "px";

    if (node.hasChildren) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "wv720-menu-toggle cs-menu-toggle";
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
      spacer.className = "wv720-menu-toggle-spacer";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    if (node.isClickable) {
      const button = createButton(
        getNodeTitle(node),
        "wv720-nav-btn cs-nav-btn" + (node.isActive ? " active" : ""),
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
      label.className = "wv720-menu-label cs-menu-label";
      label.textContent = getNodeTitle(node);
      row.appendChild(label);
    }

    return row;
  }

  function createArticleRow(node) {
    const isHomeRow = Boolean(homeArticleId) && node.depth === 0 && node.articleId === homeArticleId;
    const row = document.createElement("div");
    row.className = "cs-nav-row wv720-nav-row wv720-article-row " + getDepthClass(node.depth) + (isHomeRow ? " wv720-home-nav-row" : "");
    row.style.paddingLeft = node.depth * 10 + "px";

    const spacer = document.createElement("span");
    spacer.className = "wv720-menu-toggle-spacer";
    spacer.setAttribute("aria-hidden", "true");
    row.appendChild(spacer);

    const button = createButton(
      (isHomeRow ? "⌂ " : "") + getNodeTitle(node),
      "wv720-nav-btn cs-nav-btn" + (node.isActive ? " active" : ""),
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
      : "menus";
    railMenuItems.forEach((item) => {
      item.classList.toggle("active", item.getAttribute("data-mode") === railMode);
    });

    railScroll.innerHTML = "";
    if (railMode === "tags") {
      const wrap = document.createElement("div");
      wrap.className = "wv720-tags-pane";

      const head = document.createElement("div");
      head.className = "wv720-history-head cs-section-head";
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
      queueList.className = "wv720-history-list wv720-tags-queue-list";
      if (!queue.length) {
        const empty = document.createElement("div");
        empty.className = "wv720-history-empty cs-empty";
        empty.textContent = "No selected pages.";
        queueList.appendChild(empty);
      } else {
        queue.forEach((articleId) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "wv720-history-item cs-list-btn" + (articleId === selectedId ? " active" : "");
          item.addEventListener("click", () => navigation.openArticleById(articleId));

          const selectedTagsFromPool = tagPool && typeof tagPool.getSelectedTagsForArticle === "function"
            ? tagPool.getSelectedTagsForArticle(articleId)
            : [];
          const label = document.createElement("span");
          label.className = "wv720-queue-label";
          label.textContent = articleId;
          item.appendChild(label);

          const stripeWrap = document.createElement("span");
          stripeWrap.className = "wv720-queue-stripes";
          selectedTagsFromPool.forEach((tag) => {
            const stripe = document.createElement("span");
            stripe.className = "wv720-queue-stripe cs-queue-stripe";
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
      controls.className = "wv720-tags-controls";
      const prevId = hasCurrentInQueue && currentIndex > 0 ? queue[currentIndex - 1] : null;
      const nextId = hasCurrentInQueue
        ? (currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null)
        : (queue.length ? queue[0] : null);

      const prevButton = createButton("<", "wv720-tags-nav-btn cs-mini-nav-btn", () => {
        if (prevId) {
          navigation.openArticleById(prevId);
        }
      });
      prevButton.disabled = !prevId;
      controls.appendChild(prevButton);

      const nextButton = createButton(">", "wv720-tags-nav-btn cs-mini-nav-btn", () => {
        if (nextId) {
          navigation.openArticleById(nextId);
        }
      });
      nextButton.disabled = !nextId;
      controls.appendChild(nextButton);

      const selectedCount = document.createElement("div");
      selectedCount.className = "wv720-tags-selected cs-section-head";
      selectedCount.textContent = "Selected: " + queue.length;
      controls.appendChild(selectedCount);

      const selectedTags = new Set(
        tagPool && typeof tagPool.getSelectedTags === "function"
          ? tagPool.getSelectedTags()
          : []
      );
      const clearTags = createButton("Clear", "wv720-tag-clear wv720-tag-clear-inline cs-chip-btn", () => {
        if (tagPool && typeof tagPool.clear === "function") {
          tagPool.clear();
        }
      });
      clearTags.disabled = selectedTags.size === 0;
      controls.appendChild(clearTags);
      wrap.appendChild(controls);

      const tagWrap = document.createElement("div");
      tagWrap.className = "wv720-tagpool";
      const tagHead = document.createElement("div");
      tagHead.className = "wv720-tagpool-head cs-section-head";
      tagHead.textContent = "Tag pool:";
      tagWrap.appendChild(tagHead);

      const tags = tagPool && typeof tagPool.getAllTags === "function"
        ? tagPool.getAllTags()
        : [];
      const tagList = document.createElement("div");
      tagList.className = "wv720-tagpool-list";
      tags.forEach((tag) => {
        const color = selectedTagColors[tag];
        const tagButton = createButton(
          tag,
          "wv720-tag-btn cs-chip-btn" + (selectedTags.has(tag) ? " active" : ""),
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
      wrap.className = "wv720-history";

      const head = document.createElement("div");
      head.className = "wv720-history-head cs-section-head";
      head.textContent = "Your last visited pages (max. 20):";
      wrap.appendChild(head);

      if (!historyList.length) {
        const empty = document.createElement("div");
        empty.className = "wv720-history-empty cs-empty";
        empty.textContent = "No visited pages yet.";
        wrap.appendChild(empty);
      } else {
        const list = document.createElement("div");
        list.className = "wv720-history-list";
        historyList.forEach((articleId, index) => {
          const item = createButton(
            String(index + 1) + ". " + articleId,
            "wv720-history-item cs-list-btn",
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
      wrap.className = "wv720-config-panel";

      const sectionTitle = document.createElement("div");
      sectionTitle.className = "wv720-history-head cs-section-head";
      sectionTitle.textContent = "Configuration";
      wrap.appendChild(sectionTitle);

      const state = configuration && typeof configuration.readState === "function"
        ? configuration.readState()
        : null;
      const toggle = createButton(
        "Color Schemes",
        "wv720-config-toggle cs-action-btn",
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
        schemeList.className = "wv720-config-scheme-list";
        const schemes = state && Array.isArray(state.schemes) ? state.schemes : [];
        const selectedKey = state && typeof state.selectedSchemeKey === "string" ? state.selectedSchemeKey : "";
        schemes.forEach((scheme) => {
          const preview = scheme && scheme.preview ? scheme.preview : {};
          const isEnabled = scheme && scheme.key === "minty-premature";
          const button = document.createElement("button");
          button.type = "button";
          button.className = "wv720-config-scheme-btn cs-scheme-btn" + (selectedKey === scheme.key ? " active" : "");
          button.textContent = scheme.label;
          button.style.background = preview.interactive || "#E5F1E8";
          button.style.color = getReadableTextColor(preview.interactive || "#E5F1E8");
          button.style.borderColor = preview.border || "#B8CABC";
          button.disabled = !isEnabled;
          button.addEventListener("click", () => {
            if (!isEnabled) {
              return;
            }
            if (configuration && typeof configuration.setSelectedScheme === "function") {
              configuration.setSelectedScheme(scheme.key);
            }
          });
          schemeList.appendChild(button);
        });
        wrap.appendChild(schemeList);

        const pastelRow = document.createElement("div");
        pastelRow.className = "wv720-config-pastel-row";
        const pastelLabel = document.createElement("label");
        pastelLabel.className = "wv720-config-pastel-label cs-section-head";
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

    pane.className = "";
    pane.style.background = "";

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
    if (
      event.type === "open" ||
      event.type === "back-empty" ||
      event.type === "set-nav-area" ||
      event.type === "navigation-history-go-back"
    ) {
      render();
      persistSession();
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

  railToggleButton.addEventListener("click", () => setRailOpen(!railOpen));
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
    const wrap = host.querySelector(".wv720-nav-rail-menu-wrap");
    if (wrap && !wrap.contains(event.target)) {
      setRailMenuOpen(false);
    }
  };
  document.addEventListener("click", onDocumentClick);

  const onKeyDown = (event) => {
    if (event.key === "Escape" && railOpen) {
      setRailOpen(false);
    }
  };
  window.addEventListener("keydown", onKeyDown);

  setRailOpen(railOpen);
  setRailMode(navigation.readState().navArea || "menus");

  const startupArticleId = session.currentArticleId && articleMap.has(session.currentArticleId)
    ? session.currentArticleId
    : fallbackArticleId;
  if (startupArticleId && !navigation.readState().selectedArticleId) {
    navigation.openArticleById(startupArticleId);
  }

  return {
    key: "720",
    articlePane: pane,
    teardown() {
      unsubscribe();
      unsubscribeTagPool();
      unsubscribePagingQueue();
      unsubscribeConfiguration();
      document.removeEventListener("click", onDocumentClick);
      window.removeEventListener("keydown", onKeyDown);
      host.innerHTML = "";
    }
  };
}
