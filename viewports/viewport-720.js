import { createButton, getDepthClass } from "../core/nav-rail-utils.js";
import { ensureSelectedArticleOrFallback } from "../core/article-fallback.js";
import { createHistoryScreen } from "../core/navarea-history-screen.js";
import { bindOutsideDismiss } from "../core/overlay-dismiss.js";
import { createTagsScreen } from "../core/navarea-tags-screen.js";
import { renderConfigurationPreviewPane } from "../core/configuration-preview-builder.js";
import { bindViewportSubscriptions } from "../core/viewport-subscriptions.js";
import { createNavAreaController } from "../core/nav-area-controller.js";
import { renderTreeRows } from "../core/nav-tree-renderer.js";
import { resolveRailMode, setMenuItemsActive } from "../core/nav-area-mode.js";
import { createConfigurationPanel } from "../core/navarea-configuration-panel.js";
import { createNavTreeRowBuilders } from "../core/nav-tree-builder-factory.js";

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
  let configurationPanelMode = "overview";
  const railModeController = createNavAreaController({
    allowedModes: ["menus", "tags", "history", "configuration"],
    fallbackMode: "menus"
  });

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
    const next = railModeController.normalize(mode);
    navigation.setNavArea(next);
    const navState = navigation.readState();
    const railMode = resolveRailMode(navState.navArea, "menus");
    setMenuItemsActive(railMenuItems, railMode);
    if (previousMode === "configuration" && next !== "configuration") {
      configurationPanelMode = "overview";
      if (configuration && typeof configuration.setColorSchemesVisible === "function") {
        configuration.setColorSchemesVisible(false);
      }
      const currentId = navigation.readState().selectedArticleId;
      if (currentId) {
        navigation.openArticleById(currentId);
      }
    }
    if (next !== "configuration") {
      ensureSelectedArticleOrFallback({
        navigation,
        articleMap,
        fallbackArticleId
      });
    }
    setRailMenuOpen(false);
    render();
  }

  function renderConfigurationPreviewIntoPane() {
    if (!configuration || typeof configuration.getSelectedScheme !== "function") {
      return;
    }
    const selected = configuration.getSelectedScheme();
    renderConfigurationPreviewPane({
      pane,
      scheme: selected,
      classPrefix: "wv720"
    });
  }

  const rowBuilders = createNavTreeRowBuilders({
    siteMap,
    createButton,
    depthClassName: getDepthClass,
    homeArticleId,
    menuRowClassName: "cs-nav-row wv720-nav-row wv720-menu-row",
    articleRowClassName: "cs-nav-row wv720-nav-row wv720-article-row",
    homeRowClassName: "wv720-home-nav-row",
    menuToggleClassName: "wv720-menu-toggle cs-menu-toggle",
    toggleSpacerClassName: "wv720-menu-toggle-spacer",
    menuLabelClassName: "wv720-menu-label cs-menu-label",
    navButtonClassName: "wv720-nav-btn cs-nav-btn",
    onMenuToggle(node) {
      siteMap.toggleNode(node.nodeId);
      render();
    },
    onNodeOpen(articleId) {
      navigation.openArticleById(articleId);
    }
  });

  function render() {
    const runtime = navigation.readState();
    const historyList = Array.isArray(runtime.navigationHistory) ? runtime.navigationHistory : [];
    headBackButton.disabled = historyList.length === 0;

    const railMode = resolveRailMode(runtime.navArea, "menus");
    setMenuItemsActive(railMenuItems, railMode);

    railScroll.innerHTML = "";
    if (railMode === "tags") {
      railScroll.appendChild(createTagsScreen({
        classes: {
          wrap: "wv720-tags-pane",
          head: "wv720-history-head cs-section-head",
          queueList: "wv720-history-list wv720-tags-queue-list",
          empty: "wv720-history-empty cs-empty",
          queueItem: "wv720-history-item cs-list-btn",
          queueLabel: "wv720-queue-label",
          queueStripes: "wv720-queue-stripes",
          queueStripe: "wv720-queue-stripe cs-queue-stripe",
          controls: "wv720-tags-controls",
          pagerButton: "wv720-tags-nav-btn cs-mini-nav-btn",
          selectedCount: "wv720-tags-selected cs-section-head",
          clearButton: "wv720-tag-clear wv720-tag-clear-inline cs-chip-btn",
          tagWrap: "wv720-tagpool",
          tagHead: "wv720-tagpool-head cs-section-head",
          tagList: "wv720-tagpool-list",
          tagButton: "wv720-tag-btn cs-chip-btn"
        },
        headText: "Pages to read, selected by tags:",
        emptyText: "No selected pages.",
        queue: pagingQueue && typeof pagingQueue.getQueue === "function" ? pagingQueue.getQueue() : [],
        selectedArticleId: runtime.selectedArticleId,
        selectedTagColors: tagPool && typeof tagPool.getSelectedTagColors === "function" ? tagPool.getSelectedTagColors() : {},
        getSelectedTagsForArticle(articleId) {
          return tagPool && typeof tagPool.getSelectedTagsForArticle === "function"
            ? tagPool.getSelectedTagsForArticle(articleId)
            : [];
        },
        getAllTags() {
          return tagPool && typeof tagPool.getAllTags === "function" ? tagPool.getAllTags() : [];
        },
        getSelectedTags() {
          return tagPool && typeof tagPool.getSelectedTags === "function" ? tagPool.getSelectedTags() : [];
        },
        onOpenArticle(articleId) {
          navigation.openArticleById(articleId);
        },
        onToggleTag(tag) {
          if (tagPool && typeof tagPool.toggleTag === "function") {
            tagPool.toggleTag(tag);
          }
        },
        onClearTags() {
          if (tagPool && typeof tagPool.clear === "function") {
            tagPool.clear();
          }
        },
        articleMap,
        createButton,
        showPager: true
      }));
      return;
    }

    if (railMode === "history") {
      railScroll.appendChild(createHistoryScreen({
        wrapClassName: "wv720-history",
        headClassName: "wv720-history-head cs-section-head",
        headerText: "Your last visited pages (max. 20):",
        historyIds: historyList,
        emptyClassName: "wv720-history-empty cs-empty",
        emptyText: "No visited pages yet.",
        listClassName: "wv720-history-list",
        itemClassName: "wv720-history-item cs-list-btn",
        createButton,
        onOpenArticle(articleId) {
          navigation.openArticleById(articleId);
        }
      }));
      return;
    }

    if (railMode === "configuration") {
      renderConfigurationPreviewIntoPane();
      const state = configuration && typeof configuration.readState === "function"
        ? configuration.readState()
        : null;
      railScroll.appendChild(createConfigurationPanel({
        createButton,
        state,
        mode: configurationPanelMode,
        classNames: {
          wrap: "wv720-config-panel",
          sectionTitle: "wv720-history-head cs-section-head",
          toggle: "wv720-config-toggle cs-action-btn",
          actionsRow: "wv720-config-actions",
          schemeList: "wv720-config-scheme-list",
          schemeButton: "wv720-config-scheme-btn cs-scheme-btn",
          pastelRow: "wv720-config-pastel-row",
          pastelLabel: "wv720-config-pastel-label cs-section-head",
          resolutionList: "wv720-config-resolution-list",
          resolutionButton: "wv720-config-resolution-btn cs-scheme-btn"
        },
        isEnabled(scheme) {
          return Boolean(scheme);
        },
        onOpenColorSchemes() {
          configurationPanelMode = "color-schemes";
          if (configuration && typeof configuration.setColorSchemesVisible === "function") {
            configuration.setColorSchemesVisible(true);
          }
          render();
        },
        onOpenScreenResolutions() {
          configurationPanelMode = "screen-resolutions";
          if (configuration && typeof configuration.setColorSchemesVisible === "function") {
            configuration.setColorSchemesVisible(false);
          }
          render();
        },
        onBack() {
          configurationPanelMode = "overview";
          if (configuration && typeof configuration.setColorSchemesVisible === "function") {
            configuration.setColorSchemesVisible(false);
          }
          render();
        },
        onSelectScheme(scheme) {
          if (!scheme) {
            return;
          }
          if (configuration && typeof configuration.setSelectedScheme === "function") {
            configuration.setSelectedScheme(scheme.key);
          }
        },
        onPastelChange(nextHex) {
          if (configuration && typeof configuration.setPastelBaseColor === "function") {
            configuration.setPastelBaseColor(nextHex);
          }
        },
        onSetViewportMode(mode) {
          if (configuration && typeof configuration.setViewportMode === "function") {
            configuration.setViewportMode(mode);
          }
        }
      }));
      return;
    }

    pane.className = "";
    pane.style.background = "";

    railScroll.appendChild(navTreeContainer);
    renderTreeRows({
      container: navTreeContainer,
      tree: siteMap.getTreeModel(runtime.selectedArticleId),
      createMenuRow: rowBuilders.createMenuRow,
      createArticleRow: rowBuilders.createArticleRow
    });
  }

  const unbindSubscriptions = bindViewportSubscriptions({
    navigation,
    tagPool,
    pagingQueue,
    configuration,
    onNavigation(event) {
      if (
        event.type === "open" ||
        event.type === "back-empty" ||
        event.type === "set-nav-area" ||
        event.type === "navigation-history-go-back"
      ) {
        render();
        persistSession();
      }
    },
    onTagPool() {
      render();
    },
    onPagingQueue() {
      render();
    },
    onConfiguration(event) {
      if (navigation.readState().navArea !== "configuration") {
        return;
      }
      if (event && event.type === "set-pastel-base-color") {
        renderConfigurationPreviewIntoPane();
        return;
      }
      render();
    }
  });

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

  const unbindMenuDismiss = bindOutsideDismiss({
    root: host,
    isEnabled() {
      return !railMenuList.hidden;
    },
    isInside(event, path) {
      const wrap = host.querySelector(".wv720-nav-rail-menu-wrap");
      if (!wrap) {
        return false;
      }
      if (event.target instanceof Node) {
        return wrap.contains(event.target);
      }
      return Array.isArray(path) && path.includes(wrap);
    },
    onDismiss() {
      setRailMenuOpen(false);
    }
  });

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
      unbindSubscriptions();
      unbindMenuDismiss();
      window.removeEventListener("keydown", onKeyDown);
      host.innerHTML = "";
    }
  };
}
