import { mountErrorIntoPane } from "../core/content.js";
import { ensureColorSchemeStyleLoaded } from "../core/color-scheme-style.js";
import { createSharedRuntimeSession } from "../core/shared-runtime.js";
import { ensureStyleLoaded } from "../core/style-loader.js";
import { createViewport1080 } from "../viewports/viewport-1080.js";
import { createViewport720 } from "../viewports/viewport-720.js";
import { createViewport360 } from "../viewports/viewport-360.js";

const OBJECT_DEFS = [
  { key: "Navigation", label: "Navigation", active: true },
  { key: "SiteMap", label: "SiteMap", active: true },
  { key: "TagPool", label: "TagPool", active: true },
  { key: "PagingQueue", label: "PagingQueue", active: true },
  { key: "NavigationHistory", label: "NavigationHistory", active: true },
  { key: "InternalLinks", label: "InternalLinks", active: true },
  { key: "Configuration", label: "Configuration", active: true }
];

const dom = {
  host: document.getElementById("labViewportHost"),
  frame: document.getElementById("labFrame"),
  buttons: document.getElementById("viewportButtons"),
  objectsToggle: document.getElementById("jsObjectsToggle"),
  objectsList: document.getElementById("jsObjectsList"),
  objectsWorkspace: document.getElementById("jsObjectsWorkspace")
};

const runtime = {
  profiles: null,
  activeViewportInstance: null,
  activeStyleNode: null,
  activeColorSchemeStyleNode: null,
  unbindDelegation: null,
  unbindConfigurationStyle: null,
  objectsPanelOpen: false,
  selectedObjectKey: "SiteMap",
  objectStateTimer: null,
  unbindObjectSubscriptions: [],
  objectTracking: {},
  objectsListOpen: false
};

const sharedRuntime = createSharedRuntimeSession({
  getActivePane() {
    return runtime.activeViewportInstance ? runtime.activeViewportInstance.articlePane : null;
  }
});

function persistLabUiState() {
  const settingsStore = sharedRuntime.getSettingsStore();
  settingsStore.setObjectSnapshot("labUi", {
    selectedProfileKey: sharedRuntime.runtimeState.activeViewport || null,
    selectedObjectKey: runtime.selectedObjectKey || "SiteMap"
  });
  settingsStore.schedulePersist(120);
}

function normalizeObjectKey(value) {
  const key = typeof value === "string" ? value : "";
  return OBJECT_DEFS.some((definition) => definition.key === key) ? key : "SiteMap";
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function ensureTracking(key) {
  if (!runtime.objectTracking[key]) {
    runtime.objectTracking[key] = {
      prev: null,
      red: new Set(),
      orange: new Set(),
      blue: new Set(),
      treeFieldRed: new Set(),
      treeFieldOrange: new Set(),
      treeFieldBlue: new Set()
    };
  }
  return runtime.objectTracking[key];
}

async function loadProfiles() {
  const response = await fetch("../config/viewport-profiles.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Missing config/viewport-profiles.json");
  }
  return response.json();
}

function setViewportSize(profile) {
  dom.host.style.width = profile.width + "px";
  if (profile.key === "360") {
    dom.host.style.height = profile.height + "px";
  } else {
    dom.host.style.height = "";
  }
}

async function ensureViewportStyle(styleFile) {
  const href = "../styles/" + styleFile;
  await ensureStyleLoaded(runtime, href);
}

async function ensureSharedRuntime() {
  await sharedRuntime.ensureLoaded();
  await sharedRuntime.getSettingsStore().load();
  const configuration = sharedRuntime.getConfiguration();
  if (configuration && typeof configuration.readState === "function") {
    const state = configuration.readState();
    await ensureColorSchemeStyleLoaded(runtime, state.selectedSchemeKey);
  }
  if (!runtime.unbindConfigurationStyle && configuration && typeof configuration.subscribe === "function") {
    runtime.unbindConfigurationStyle = configuration.subscribe((event) => {
      if (!event || (event.type !== "set-selected-scheme" && event.type !== "load-snapshot")) {
        return;
      }
      const state = configuration.readState();
      ensureColorSchemeStyleLoaded(runtime, state.selectedSchemeKey).catch(() => {});
    });
  }
}

function clearActiveViewport() {
  if (runtime.unbindDelegation) {
    runtime.unbindDelegation();
    runtime.unbindDelegation = null;
  }
  if (runtime.activeViewportInstance) {
    runtime.activeViewportInstance.teardown();
    runtime.activeViewportInstance = null;
  }
}

function getProfileNavigation(profileKey) {
  return profileKey === "1080" || profileKey === "720" || profileKey === "360"
    ? sharedRuntime.getNavigationObject()
    : sharedRuntime.getNavigation();
}

function createViewportInstance(profile) {
  const navigation = getProfileNavigation(profile.key);
  if (profile.key === "1080") {
    return createViewport1080({
      host: dom.host,
      navigation,
      siteMap: sharedRuntime.getSiteMap(),
      tagPool: sharedRuntime.getTagPool(),
      pagingQueue: sharedRuntime.getPagingQueue(),
      configuration: sharedRuntime.getConfiguration(),
      homeArticleId: sharedRuntime.getDefaultArticleId()
    });
  }
  if (profile.key === "720") {
    return createViewport720({
      host: dom.host,
      navigation,
      siteMap: sharedRuntime.getSiteMap(),
      tagPool: sharedRuntime.getTagPool(),
      pagingQueue: sharedRuntime.getPagingQueue(),
      configuration: sharedRuntime.getConfiguration(),
      settingsStore: sharedRuntime.getSettingsStore(),
      articleMap: sharedRuntime.runtimeState.articleMap,
      homeArticleId: sharedRuntime.getDefaultArticleId()
    });
  }
  return createViewport360({
    host: dom.host,
    navigation,
    siteMap: sharedRuntime.getSiteMap(),
    tagPool: sharedRuntime.getTagPool(),
    pagingQueue: sharedRuntime.getPagingQueue(),
    configuration: sharedRuntime.getConfiguration(),
    settingsStore: sharedRuntime.getSettingsStore(),
    websiteTopLevel: sharedRuntime.runtimeState.website ? sharedRuntime.runtimeState.website.topLevel : [],
    articleMap: sharedRuntime.runtimeState.articleMap,
    tagMap: sharedRuntime.runtimeState.tags,
    homeArticleId: sharedRuntime.getDefaultArticleId()
  });
}

async function activateProfile(profileKey) {
  const profile = runtime.profiles[profileKey];
  if (!profile) {
    return;
  }

  setViewportSize(profile);
  await ensureViewportStyle(profile.style);
  clearActiveViewport();

  if (profile.status === "active") {
    await ensureSharedRuntime();
    runtime.activeViewportInstance = createViewportInstance(profile);
    const navigation = getProfileNavigation(profile.key);
    runtime.unbindDelegation = sharedRuntime.bindLinkDelegation(runtime.activeViewportInstance.articlePane, navigation);

    const current = navigation.readState().selectedArticleId;
    if (!current) {
      const fallback = sharedRuntime.getDefaultArticleId();
      if (fallback) {
        navigation.openArticleById(fallback);
      }
    } else {
      navigation.openArticleById(current);
    }
  } else {
    runtime.activeViewportInstance = createViewportInstance(profile);
    mountErrorIntoPane(runtime.activeViewportInstance.articlePane, "Viewport " + profile.key + " is scaffolded but inactive in this phase.");
  }

  Array.from(dom.buttons.querySelectorAll("button[data-profile]"))
    .forEach((button) => button.classList.toggle("active", button.getAttribute("data-profile") === profileKey));

  sharedRuntime.runtimeState.activeViewport = profileKey;
  persistLabUiState();
}

function buildFullTreeFromWebsite(topLevel, selectedArticleIDs, expandedNodeIds) {
  const selectedSet = new Set(Array.isArray(selectedArticleIDs) ? selectedArticleIDs : []);
  const nodes = [];
  function walk(entries, depth, parentNodeId, path) {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const nextPath = path.concat(index);
      const nodeId = "node:" + nextPath.join(".");
      const hasChildren = Array.isArray(entry.children) && entry.children.length > 0;
      const articleId = typeof entry.articleId === "string" ? entry.articleId : null;
      nodes.push({
        nodeId,
        parentNodeId,
        depth,
        type: entry.type || "unknown",
        label: typeof entry.label === "string" ? entry.label : "",
        title: typeof entry.title === "string" ? entry.title : "",
        articleId,
        hasChildren,
        isExpanded: hasChildren ? expandedNodeIds.includes(nodeId) : false,
        isSelected: Boolean(articleId) && selectedSet.has(articleId)
      });
      walk(entry.children, depth + 1, nodeId, nextPath);
    });
  }
  walk(topLevel, 0, null, []);
  return nodes;
}

function getMutableState(objectKey) {
  if (objectKey === "SiteMap") {
    return {
      object: objectKey,
      active: true,
      mode: "deactivated-for-current-navigation",
      note: "Current hierarchy navigation activity is owned by Navigation object."
    };
  }
  if (objectKey === "Navigation") {
    const navigation = sharedRuntime.getNavigationObject();
    return navigation && typeof navigation.readState === "function"
      ? Object.assign({ object: objectKey, active: true }, navigation.readState())
      : { object: objectKey, active: true, available: false };
  }
  if (objectKey === "TagPool") {
    const tagPool = sharedRuntime.getTagPool();
    return tagPool && typeof tagPool.readState === "function"
      ? Object.assign({ object: objectKey, active: true }, tagPool.readState())
      : { object: objectKey, active: true, available: false };
  }
  if (objectKey === "PagingQueue") {
    const pagingQueue = sharedRuntime.getPagingQueue();
    return pagingQueue && typeof pagingQueue.readState === "function"
      ? Object.assign({ object: objectKey, active: true }, pagingQueue.readState())
      : { object: objectKey, active: true, available: false };
  }
  if (objectKey === "NavigationHistory") {
    const navigationHistory = sharedRuntime.getNavigationHistory();
    return navigationHistory && typeof navigationHistory.getNavigationHistoryState === "function"
      ? Object.assign({ object: objectKey, active: true }, navigationHistory.getNavigationHistoryState())
      : { object: objectKey, active: true, available: false };
  }
  if (objectKey === "InternalLinks") {
    const internalLinks = sharedRuntime.getInternalLinks();
    return internalLinks && typeof internalLinks.readState === "function"
      ? Object.assign({ object: objectKey, active: true }, internalLinks.readState())
      : { object: objectKey, active: true, available: false };
  }
  if (objectKey === "Configuration") {
    const configuration = sharedRuntime.getConfiguration();
    return configuration && typeof configuration.readState === "function"
      ? Object.assign({ object: objectKey, active: true }, configuration.readState())
      : { object: objectKey, active: true, available: false };
  }
  return {
    object: objectKey,
    active: false
  };
}

function updateChangeTracking(objectKey, snapshot) {
  const tracker = ensureTracking(objectKey);
  const prev = tracker.prev;
  const changed = new Set();
  const changedTreeFields = new Set();

  if (!prev) {
    tracker.prev = snapshot;
    tracker.red = new Set();
    tracker.orange = new Set();
    tracker.blue = new Set();
    tracker.treeFieldRed = new Set();
    tracker.treeFieldOrange = new Set();
    tracker.treeFieldBlue = new Set();
    return;
  } else {
    const keys = new Set(Object.keys(snapshot).concat(Object.keys(prev)));
    keys.forEach((key) => {
      if (safeStringify(prev[key]) !== safeStringify(snapshot[key])) {
        changed.add(key);
      }
    });

    const prevTree = Array.isArray(prev.fullTree) ? prev.fullTree : [];
    const nextTree = Array.isArray(snapshot.fullTree) ? snapshot.fullTree : [];
    const prevById = new Map(prevTree.map((node) => [node.nodeId, node]));
    nextTree.forEach((node) => {
      if (!node || typeof node !== "object" || typeof node.nodeId !== "string") {
        return;
      }
      const older = prevById.get(node.nodeId);
      if (!older) {
        changedTreeFields.add(node.nodeId + ":isSelected");
        changedTreeFields.add(node.nodeId + ":isExpanded");
        return;
      }
      if (Boolean(older.isSelected) !== Boolean(node.isSelected)) {
        changedTreeFields.add(node.nodeId + ":isSelected");
      }
      if (Boolean(older.isExpanded) !== Boolean(node.isExpanded)) {
        changedTreeFields.add(node.nodeId + ":isExpanded");
      }
    });
  }

  if (changed.size > 0) {
    tracker.blue = new Set(tracker.orange);
    tracker.orange = new Set(tracker.red);
    tracker.red = changed;
  }
  if (changedTreeFields.size > 0) {
    tracker.treeFieldBlue = new Set(tracker.treeFieldOrange);
    tracker.treeFieldOrange = new Set(tracker.treeFieldRed);
    tracker.treeFieldRed = changedTreeFields;
  }
  tracker.prev = snapshot;
}

function getHeatClass(objectKey, variableKey) {
  const tracker = ensureTracking(objectKey);
  if (tracker.red.has(variableKey)) {
    return "heat-red";
  }
  if (tracker.orange.has(variableKey)) {
    return "heat-orange";
  }
  if (tracker.blue.has(variableKey)) {
    return "heat-blue";
  }
  return "";
}

function getTreeFieldHeatClass(objectKey, nodeId, fieldKey) {
  const tracker = ensureTracking(objectKey);
  const path = nodeId + ":" + fieldKey;
  if (tracker.treeFieldRed.has(path)) {
    return "lab-value-heat-red";
  }
  if (tracker.treeFieldOrange.has(path)) {
    return "lab-value-heat-orange";
  }
  if (tracker.treeFieldBlue.has(path)) {
    return "lab-value-heat-blue";
  }
  return "";
}

function getObjectHeatClass(objectKey) {
  const tracker = ensureTracking(objectKey);
  if (tracker.red.size || tracker.treeFieldRed.size) {
    return "heat-red";
  }
  if (tracker.orange.size || tracker.treeFieldOrange.size) {
    return "heat-orange";
  }
  if (tracker.blue.size || tracker.treeFieldBlue.size) {
    return "heat-blue";
  }
  return "";
}

function refreshTrackingAndViews() {
  OBJECT_DEFS.forEach((definition) => {
    const snapshot = getMutableState(definition.key);
    updateChangeTracking(definition.key, snapshot);
  });
  if (runtime.objectsListOpen) {
    renderObjectList();
  }
  if (runtime.objectsPanelOpen) {
    renderObjectWorkspace();
  }
}

function renderObjectList() {
  dom.objectsList.innerHTML = "";
  OBJECT_DEFS.forEach((definition) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lab-object-btn"
      + (runtime.selectedObjectKey === definition.key ? " selected" : "")
      + (definition.active ? " active" : " inactive")
      + " " + getObjectHeatClass(definition.key);
    button.textContent = (definition.label || definition.key) + (definition.active ? "" : " (inactive)");
    button.addEventListener("click", () => {
      runtime.selectedObjectKey = definition.key;
      persistLabUiState();
      setObjectViewOpen(true);
      renderObjectList();
      renderObjectWorkspace();
      bindObjectStateSync();
    });
    dom.objectsList.appendChild(button);
  });
}

function renderObjectWorkspace() {
  const snapshot = getMutableState(runtime.selectedObjectKey);

  const wrap = document.createElement("div");
  const head = document.createElement("div");
  head.className = "lab-objects-head";
  const h2 = document.createElement("h2");
  h2.textContent = runtime.selectedObjectKey + " mutable state";
  const status = document.createElement("span");
  status.className = "status";
  status.textContent = snapshot.active ? "live" : "inactive";
  head.appendChild(h2);
  head.appendChild(status);
  wrap.appendChild(head);

  const legend = document.createElement("p");
  legend.className = "lab-heat-legend";
  legend.textContent = "Changes: red (latest), orange (previous), blue (older).";
  wrap.appendChild(legend);

  const variables = document.createElement("div");
  variables.className = "lab-vars";
  Object.keys(snapshot).forEach((key) => {
    const item = document.createElement("div");
    const topHeat = key === "fullTree" ? "" : getHeatClass(runtime.selectedObjectKey, key);
    item.className = "lab-var-item " + topHeat;

    const label = document.createElement("div");
    label.className = "lab-var-key";
    label.textContent = key;
    item.appendChild(label);

    if (key === "fullTree" && Array.isArray(snapshot.fullTree)) {
      const treeWrap = document.createElement("div");
      treeWrap.className = "lab-tree-list";
      snapshot.fullTree.forEach((node) => {
        const row = document.createElement("div");
        row.className = "lab-tree-row";
        row.style.paddingLeft = String((Number(node.depth) || 0) * 12) + "px";

        const head = document.createElement("span");
        head.textContent = (node.type || "node") + " " + (node.title || node.label || node.articleId || node.nodeId);
        row.appendChild(head);

        const selected = document.createElement("span");
        selected.className = "lab-tree-flag " + getTreeFieldHeatClass(runtime.selectedObjectKey, node.nodeId, "isSelected");
        selected.textContent = " isSelected=" + String(Boolean(node.isSelected));
        row.appendChild(selected);

        const expanded = document.createElement("span");
        expanded.className = "lab-tree-flag " + getTreeFieldHeatClass(runtime.selectedObjectKey, node.nodeId, "isExpanded");
        expanded.textContent = " isExpanded=" + String(Boolean(node.isExpanded));
        row.appendChild(expanded);

        treeWrap.appendChild(row);
      });
      item.appendChild(treeWrap);
    } else {
      const value = document.createElement("pre");
      value.className = "lab-var-value";
      value.textContent = safeStringify(snapshot[key]);
      item.appendChild(value);
    }

    variables.appendChild(item);
  });
  wrap.appendChild(variables);

  dom.objectsWorkspace.innerHTML = "";
  dom.objectsWorkspace.appendChild(wrap);
}

function bindObjectStateSync() {
  runtime.unbindObjectSubscriptions.forEach((unbind) => unbind());
  runtime.unbindObjectSubscriptions = [];
  if (runtime.objectStateTimer) {
    window.clearInterval(runtime.objectStateTimer);
    runtime.objectStateTimer = null;
  }
  if (!(runtime.objectsPanelOpen || runtime.objectsListOpen)) {
    return;
  }

  const objectMap = {
    SiteMap: sharedRuntime.getSiteMap(),
    Navigation: sharedRuntime.getNavigationObject(),
    TagPool: sharedRuntime.getTagPool(),
    PagingQueue: sharedRuntime.getPagingQueue(),
    NavigationHistory: sharedRuntime.getNavigationHistory(),
    InternalLinks: sharedRuntime.getInternalLinks(),
    Configuration: sharedRuntime.getConfiguration()
  };
  Object.keys(objectMap).forEach((key) => {
    const object = objectMap[key];
    if (object && typeof object.subscribe === "function") {
      runtime.unbindObjectSubscriptions.push(object.subscribe(() => {
        refreshTrackingAndViews();
      }));
    }
  });

  runtime.objectStateTimer = window.setInterval(() => {
    refreshTrackingAndViews();
  }, 700);
}

function setObjectsPanelOpen(open) {
  runtime.objectsListOpen = Boolean(open);
  dom.objectsToggle.setAttribute("aria-expanded", runtime.objectsListOpen ? "true" : "false");
  if (runtime.objectsListOpen) {
    refreshTrackingAndViews();
    renderObjectList();
  }
  dom.objectsList.hidden = !runtime.objectsListOpen;
  dom.objectsList.style.display = runtime.objectsListOpen ? "grid" : "none";
  bindObjectStateSync();
}

function setObjectViewOpen(open) {
  runtime.objectsPanelOpen = Boolean(open);
  dom.frame.hidden = runtime.objectsPanelOpen;
  dom.objectsWorkspace.hidden = !runtime.objectsPanelOpen;

  if (!runtime.objectsPanelOpen) {
    bindObjectStateSync();
    return;
  }

  renderObjectList();
  refreshTrackingAndViews();
  bindObjectStateSync();
}

function renderControls(defaultViewport) {
  dom.buttons.innerHTML = "";

  Object.keys(runtime.profiles).forEach((profileKey) => {
    const profile = runtime.profiles[profileKey];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lab-viewport-button" + (profile.status === "stub" ? " stub" : "");
    button.textContent = profile.label;
    button.setAttribute("data-profile", profileKey);
    button.addEventListener("click", () => {
      setObjectViewOpen(false);
      activateProfile(profileKey);
    });
    dom.buttons.appendChild(button);
  });

  dom.objectsToggle.addEventListener("click", () => {
    setObjectsPanelOpen(!runtime.objectsListOpen);
  });

  setObjectsPanelOpen(false);
  setObjectViewOpen(false);
  activateProfile(defaultViewport);
}

async function start() {
  const profileConfig = await loadProfiles();
  runtime.profiles = profileConfig.profiles || {};
  await sharedRuntime.getSettingsStore().load();
  const defaultViewport = profileConfig.defaultViewport || "1080";
  const labUi = sharedRuntime.getSettingsStore().getObjectSnapshot("labUi", {
    selectedProfileKey: defaultViewport,
    selectedObjectKey: "SiteMap"
  });
  const selectedProfileKey = typeof labUi.selectedProfileKey === "string" && runtime.profiles[labUi.selectedProfileKey]
    ? labUi.selectedProfileKey
    : defaultViewport;
  runtime.selectedObjectKey = normalizeObjectKey(labUi.selectedObjectKey);
  renderControls(selectedProfileKey);
}

start().catch((error) => {
  mountErrorIntoPane(dom.host, "Lab startup failed: " + error.message);
});
