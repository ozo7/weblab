import { mountErrorIntoPane } from "../core/content.js";
import { createSharedRuntimeSession } from "../core/shared-runtime.js";
import { ensureColorSchemeStyleLoaded } from "../core/color-scheme-style.js";
import { ensureStyleLoaded } from "../core/style-loader.js";
import { createViewport1080 } from "../viewports/viewport-1080.js";
import { createViewport720 } from "../viewports/viewport-720.js";
import { createViewport360 } from "../viewports/viewport-360.js";

const host = document.getElementById("appViewportHost");

const runtime = {
  profiles: null,
  activeStyleNode: null,
  activeColorSchemeStyleNode: null,
  activeViewport: null,
  unbindDelegation: null,
  unbindConfigurationStyle: null,
  currentViewportMode: "auto",
  viewportApplyQueue: Promise.resolve(),
  resizeHandler: null,
  resizeSettleTimer: null
};

const sharedRuntime = createSharedRuntimeSession({
  useNavigationObject: true,
  getActivePane() {
    return runtime.activeViewport ? runtime.activeViewport.articlePane : null;
  }
});

async function loadProfiles() {
  const response = await fetch("/config/viewport-profiles.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Missing config/viewport-profiles.json");
  }
  return response.json();
}

async function ensureViewportStyle(styleFile) {
  const href = "../styles/" + styleFile;
  await ensureStyleLoaded(runtime, href);
}

async function applySelectedColorSchemeStyle() {
  const configuration = sharedRuntime.getConfiguration();
  if (!configuration || typeof configuration.readState !== "function") {
    return;
  }
  const state = configuration.readState();
  await ensureColorSchemeStyleLoaded(runtime, state.selectedSchemeKey, {
    pastelBaseColor: state.pastelBaseColor
  });
}

function wireColorSchemeStyleSelection() {
  if (runtime.unbindConfigurationStyle) {
    return;
  }
  const configuration = sharedRuntime.getConfiguration();
  if (!configuration || typeof configuration.subscribe !== "function") {
    return;
  }
  runtime.unbindConfigurationStyle = configuration.subscribe((event) => {
    if (!event) {
      return;
    }
    if (event.type === "set-selected-scheme" || event.type === "set-pastel-base-color" || event.type === "load-snapshot") {
      applySelectedColorSchemeStyle().catch(() => {});
    }
    if (event.type === "set-viewport-mode" || event.type === "load-snapshot") {
      queueApplyViewportMode();
    }
  });
}

function getProfileNavigation(profileKey) {
  return profileKey === "1080" || profileKey === "720" || profileKey === "360"
    ? sharedRuntime.getNavigationObject()
    : sharedRuntime.getNavigation();
}

function createViewportInstance(profileKey) {
  const navigation = getProfileNavigation(profileKey);
  if (profileKey === "1080") {
    return createViewport1080({
      host,
      navigation,
      siteMap: sharedRuntime.getSiteMap(),
      tagPool: sharedRuntime.getTagPool(),
      pagingQueue: sharedRuntime.getPagingQueue(),
      configuration: sharedRuntime.getConfiguration(),
      articleMap: sharedRuntime.runtimeState.articleMap,
      homeArticleId: sharedRuntime.getDefaultArticleId()
    });
  }
  if (profileKey === "720") {
    return createViewport720({
      host,
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
    host,
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

function mountViewport(profileKey) {
  if (runtime.activeViewport) {
    runtime.activeViewport.teardown();
    runtime.activeViewport = null;
  }
  if (runtime.unbindDelegation) {
    runtime.unbindDelegation();
    runtime.unbindDelegation = null;
  }

  const navigation = getProfileNavigation(profileKey);
  runtime.activeViewport = createViewportInstance(profileKey);
  runtime.unbindDelegation = sharedRuntime.bindLinkDelegation(runtime.activeViewport.articlePane, navigation);
}

function setViewportSize(profile) {
  host.style.width = profile.width + "px";
  if (profile.key === "360") {
    host.style.height = profile.height + "px";
  } else {
    host.style.height = "";
  }
}

function getFallbackProfileKey() {
  if (runtime.profiles["1080"]) {
    return "1080";
  }
  if (runtime.profiles["720"]) {
    return "720";
  }
  if (runtime.profiles["360"]) {
    return "360";
  }
  const keys = Object.keys(runtime.profiles || {});
  return keys.length ? keys[0] : null;
}

function resolveProfileKeyForAutoMode() {
  const keys = Object.keys(runtime.profiles || {});
  if (!keys.length) {
    return null;
  }
  const availableWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
  const ordered = keys
    .map((key) => runtime.profiles[key])
    .filter((profile) => profile && typeof profile.width === "number")
    .sort((a, b) => a.width - b.width);
  if (!ordered.length) {
    return keys[0];
  }
  let selected = ordered[0].key;
  ordered.forEach((profile) => {
    if (availableWidth >= profile.width) {
      selected = profile.key;
    }
  });
  return selected;
}

function resolveProfileKeyFromViewportMode(mode) {
  if (mode === "static-360" && runtime.profiles["360"]) {
    return "360";
  }
  if (mode === "static-720" && runtime.profiles["720"]) {
    return "720";
  }
  if (mode === "static-1080" && runtime.profiles["1080"]) {
    return "1080";
  }
  if (mode === "auto") {
    return resolveProfileKeyForAutoMode();
  }
  return getFallbackProfileKey();
}

function readViewportMode() {
  const configuration = sharedRuntime.getConfiguration();
  if (!configuration || typeof configuration.readState !== "function") {
    return "auto";
  }
  const state = configuration.readState();
  return state && typeof state.viewportMode === "string" ? state.viewportMode : "auto";
}

function queueApplyViewportMode() {
  runtime.viewportApplyQueue = runtime.viewportApplyQueue
    .then(async () => {
      const nextMode = readViewportMode();
      runtime.currentViewportMode = nextMode;
      const profileKey = resolveProfileKeyFromViewportMode(nextMode);
      if (!profileKey || !runtime.profiles[profileKey]) {
        return;
      }
      const profile = runtime.profiles[profileKey];
      setViewportSize(profile);
      await ensureViewportStyle(profile.style);
      const alreadyActive = runtime.activeViewport
        && sharedRuntime.runtimeState.activeViewport === profileKey;
      if (!alreadyActive) {
        mountViewport(profileKey);
      }

      const navigation = getProfileNavigation(profileKey);
      const current = navigation.readState().selectedArticleId;
      if (current) {
        navigation.openArticleById(current);
        sharedRuntime.runtimeState.activeViewport = profileKey;
        return;
      }
      const fallback = sharedRuntime.getDefaultArticleId();
      if (fallback) {
        navigation.openArticleById(fallback);
      }
      sharedRuntime.runtimeState.activeViewport = profileKey;
    })
    .catch(() => {});
}

function scheduleSettledViewportApply() {
  if (runtime.resizeSettleTimer) {
    window.clearTimeout(runtime.resizeSettleTimer);
  }
  runtime.resizeSettleTimer = window.setTimeout(() => {
    runtime.resizeSettleTimer = null;
    window.requestAnimationFrame(() => {
      queueApplyViewportMode();
    });
  }, 140);
}

async function start() {
  const profileConfig = await loadProfiles();
  runtime.profiles = profileConfig.profiles || {};
  if (!runtime.profiles["1080"] || !runtime.profiles["720"] || !runtime.profiles["360"]) {
    throw new Error("Missing one or more required profiles (1080/720/360) in config/viewport-profiles.json");
  }

  await sharedRuntime.ensureLoaded();
  await sharedRuntime.getSettingsStore().load();
  await applySelectedColorSchemeStyle();
  wireColorSchemeStyleSelection();
  queueApplyViewportMode();
  if (!runtime.resizeHandler) {
    runtime.resizeHandler = () => {
      if (runtime.currentViewportMode === "auto") {
        queueApplyViewportMode();
        scheduleSettledViewportApply();
      }
    };
    window.addEventListener("resize", runtime.resizeHandler);
  }
}

start().catch((error) => {
  mountErrorIntoPane(host, "App startup failed: " + error.message);
});
