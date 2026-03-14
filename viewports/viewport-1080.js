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

export function createViewport1080(options) {
  const host = options.host;
  const navigation = options.navigation;
  const siteMap = options.siteMap;
  const tagPool = options.tagPool || null;
  const pagingQueue = options.pagingQueue || null;
  const configuration = options.configuration || null;
  const homeArticleId = options.homeArticleId || null;
  const articleMap = options.articleMap instanceof Map ? options.articleMap : null;

  host.innerHTML = [
    '<div class="wv1080-stage">',
    '  <div class="wv1080-layout cs-shell">',
    '    <section class="wv1080-content-host cs-content-host" aria-label="Content viewport">',
    '      <main id="pane2main"></main>',
    '    </section>',
    '    <nav class="wv1080-rail cs-rail" aria-label="Navigation rail">',
    '      <div class="wv1080-rail-head cs-rail-head">',
    '        <div class="wv1080-rail-head-actions">',
    '          <button type="button" class="wv1080-head-btn cs-head-btn" data-action="home" aria-label="Home"><span class="cs-head-icon" aria-hidden="true">⌂</span><span>Home</span></button>',
    '          <button type="button" class="wv1080-head-btn cs-head-btn" data-action="back" aria-label="Back"><span class="cs-head-icon" aria-hidden="true">←</span><span>Back</span></button>',
    '        </div>',
    '        <div class="wv1080-rail-menu-wrap">',
    '          <button type="button" class="wv1080-rail-menu-btn cs-menu-trigger" aria-label="Open rail menu" aria-haspopup="true" aria-expanded="false">☰</button>',
    '          <div class="wv1080-rail-menu-list cs-menu-list" hidden>',
    '            <button type="button" class="wv1080-rail-menu-item cs-menu-item active" data-mode="menus">menus / sitemap</button>',
    '            <button type="button" class="wv1080-rail-menu-item cs-menu-item" data-mode="tags">tags</button>',
    '            <button type="button" class="wv1080-rail-menu-item cs-menu-item" data-mode="history">history</button>',
    '            <button type="button" class="wv1080-rail-menu-item cs-menu-item" data-mode="configuration">configuration</button>',
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
  const railScroll = host.querySelector(".wv1080-rail-scroll");
  const headHomeButton = host.querySelector('[data-action="home"]');
  const headBackButton = host.querySelector('[data-action="back"]');
  const railMenuButton = host.querySelector(".wv1080-rail-menu-btn");
  const railMenuList = host.querySelector(".wv1080-rail-menu-list");
  const railMenuItems = Array.from(host.querySelectorAll(".wv1080-rail-menu-item"));
  let underflowRafId = 0;
  let configurationPanelMode = "overview";
  let fallbackRailMode = "menus";
  const railModeController = createNavAreaController({
    allowedModes: ["menus", "tags", "history", "configuration"],
    fallbackMode: "menus"
  });

  function updateUnderflowVisualState() {
    const paneUnderflow = pane.scrollHeight <= pane.clientHeight + 1;
    const railUnderflow = railScroll.scrollHeight <= railScroll.clientHeight + 1;
    host.classList.toggle("wv1080-pane-underflow", paneUnderflow);
    host.classList.toggle("wv1080-rail-underflow", railUnderflow);
  }

  function scheduleUnderflowVisualState() {
    if (underflowRafId) {
      cancelAnimationFrame(underflowRafId);
    }
    underflowRafId = requestAnimationFrame(() => {
      underflowRafId = 0;
      updateUnderflowVisualState();
    });
  }

  function setRailMenuOpen(open) {
    const expanded = Boolean(open);
    railMenuList.hidden = !expanded;
    railMenuButton.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function setRailMode(mode) {
    const beforeState = typeof navigation.readState === "function" ? navigation.readState() : null;
    const previousMode = beforeState && typeof beforeState.navArea === "string" ? beforeState.navArea : null;
    const next = railModeController.normalize(mode);
    if (typeof navigation.setNavArea === "function") {
      navigation.setNavArea(next);
    } else {
      fallbackRailMode = next;
    }
    const navState = navigation.readState();
    const railMode = resolveRailMode(navState.navArea, fallbackRailMode);
    setMenuItemsActive(railMenuItems, railMode);
    if (previousMode === "configuration" && next !== "configuration") {
      configurationPanelMode = "overview";
      if (configuration && typeof configuration.setColorSchemesVisible === "function") {
        configuration.setColorSchemesVisible(false);
      }
      const currentId = navigation.readState().selectedArticleId;
      if (currentId && typeof navigation.openArticleById === "function") {
        navigation.openArticleById(currentId);
      }
    }
    if (next !== "configuration") {
      ensureSelectedArticleOrFallback({
        navigation,
        articleMap,
        fallbackArticleId: homeArticleId || null
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
      classPrefix: "wv1080"
    });
  }

  const rowBuilders = createNavTreeRowBuilders({
    siteMap,
    createButton,
    depthClassName: getDepthClass,
    homeArticleId,
    menuRowClassName: "cs-nav-row wv1080-nav-row wv1080-menu-row",
    articleRowClassName: "cs-nav-row wv1080-nav-row wv1080-article-row",
    homeRowClassName: "wv1080-home-nav-row",
    menuToggleClassName: "wv1080-menu-toggle cs-menu-toggle",
    toggleSpacerClassName: "wv1080-menu-toggle-spacer",
    menuLabelClassName: "wv1080-menu-label cs-menu-label",
    navButtonClassName: "wv1080-nav-btn cs-nav-btn",
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

    const railMode = resolveRailMode(runtime.navArea, fallbackRailMode);
    host.classList.toggle("wv1080-is-configuration", railMode === "configuration");
    setMenuItemsActive(railMenuItems, railMode);
    railScroll.innerHTML = "";
    if (railMode === "tags") {
      railScroll.appendChild(createTagsScreen({
        classes: {
          wrap: "wv1080-tags-pane",
          head: "wv1080-history-head cs-section-head",
          queueList: "wv1080-history-list wv1080-tags-queue-list",
          empty: "wv1080-history-empty cs-empty",
          queueItem: "wv1080-history-item cs-list-btn",
          queueLabel: "wv1080-queue-label",
          queueStripes: "wv1080-queue-stripes",
          queueStripe: "wv1080-queue-stripe cs-queue-stripe",
          controls: "wv1080-tags-controls",
          pagerButton: "wv1080-tags-nav-btn cs-mini-nav-btn",
          selectedCount: "wv1080-tags-selected cs-section-head",
          clearButton: "wv1080-tag-clear wv1080-tag-clear-inline cs-chip-btn",
          tagWrap: "wv1080-tagpool",
          tagHead: "wv1080-tagpool-head cs-section-head",
          tagList: "wv1080-tagpool-list",
          tagButton: "wv1080-tag-btn cs-chip-btn"
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
      scheduleUnderflowVisualState();
      return;
    }
    if (railMode === "history") {
      railScroll.appendChild(createHistoryScreen({
        wrapClassName: "wv1080-history",
        headClassName: "wv1080-history-head cs-section-head",
        headerText: "Your last visited pages (max. 20):",
        historyIds: Array.isArray(runtime.navigationHistory) ? runtime.navigationHistory : [],
        emptyClassName: "wv1080-history-empty cs-empty",
        emptyText: "No visited pages yet.",
        listClassName: "wv1080-history-list",
        itemClassName: "wv1080-history-item cs-list-btn",
        createButton,
        onOpenArticle(articleId) {
          navigation.openArticleById(articleId);
        }
      }));
      scheduleUnderflowVisualState();
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
          wrap: "wv1080-config-panel",
          sectionTitle: "wv1080-history-head cs-section-head",
          toggle: "wv1080-config-toggle cs-action-btn",
          actionsRow: "wv1080-config-actions",
          schemeList: "wv1080-config-scheme-list",
          schemeButton: "wv1080-config-scheme-btn cs-scheme-btn",
          pastelRow: "wv1080-config-pastel-row",
          pastelLabel: "wv1080-config-pastel-label cs-section-head",
          resolutionList: "wv1080-config-resolution-list",
          resolutionButton: "wv1080-config-resolution-btn cs-scheme-btn"
        },
        isEnabled(scheme) {
          return scheme && scheme.key === "minty-premature";
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
          if (!scheme || scheme.key !== "minty-premature") {
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
      scheduleUnderflowVisualState();
      return;
    }

    railScroll.appendChild(navTreeContainer);
    renderTreeRows({
      container: navTreeContainer,
      tree: siteMap.getTreeModel(runtime.selectedArticleId),
      createMenuRow: rowBuilders.createMenuRow,
      createArticleRow: rowBuilders.createArticleRow
    });
    scheduleUnderflowVisualState();
  }

  const unbindSubscriptions = bindViewportSubscriptions({
    navigation,
    tagPool,
    pagingQueue,
    configuration,
    onNavigation(event) {
      if (event.type === "open" || event.type === "back-empty") {
        render();
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

  const onWindowResize = () => {
    scheduleUnderflowVisualState();
  };
  window.addEventListener("resize", onWindowResize);

  const underflowObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
      scheduleUnderflowVisualState();
    })
    : null;
  if (underflowObserver) {
    underflowObserver.observe(pane);
    underflowObserver.observe(railScroll);
  }

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
      const wrap = host.querySelector(".wv1080-rail-menu-wrap");
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

  setRailMode(navigation.readState().navArea || "menus");
  scheduleUnderflowVisualState();

  return {
    key: "1080",
    articlePane: pane,
    teardown() {
      unbindSubscriptions();
      unbindMenuDismiss();
      window.removeEventListener("resize", onWindowResize);
      if (underflowObserver) {
        underflowObserver.disconnect();
      }
      if (underflowRafId) {
        cancelAnimationFrame(underflowRafId);
        underflowRafId = 0;
      }
      host.innerHTML = "";
    }
  };
}
