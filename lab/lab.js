import { mountErrorIntoPane } from "../core/content.js";
import { createSharedRuntimeSession } from "../core/shared-runtime.js";
import { ensureStyleLoaded } from "../core/style-loader.js";
import { createViewport1080 } from "../viewports/viewport-1080.js";
import { createViewport720 } from "../viewports/viewport-720.js";
import { createViewport360 } from "../viewports/viewport-360.js";

const dom = {
  host: document.getElementById("labViewportHost"),
  frame: document.getElementById("labFrame"),
  buttons: document.getElementById("viewportButtons")
};

const runtime = {
  profiles: null,
  activeViewportInstance: null,
  activeStyleNode: null,
  unbindDelegation: null
};

const sharedRuntime = createSharedRuntimeSession({
  getActivePane() {
    return runtime.activeViewportInstance ? runtime.activeViewportInstance.articlePane : null;
  }
});

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

function createViewportInstance(profile) {
  if (profile.key === "1080") {
    return createViewport1080({
      host: dom.host,
      navigation: sharedRuntime.getNavigation(),
      navTree: sharedRuntime.getNavTree(),
      homeArticleId: sharedRuntime.getDefaultArticleId()
    });
  }
  if (profile.key === "720") {
    return createViewport720({
      host: dom.host,
      navigation: sharedRuntime.getNavigation(),
      settingsStore: sharedRuntime.getSettingsStore(),
      websiteTopLevel: sharedRuntime.runtimeState.website ? sharedRuntime.runtimeState.website.topLevel : [],
      articleMap: sharedRuntime.runtimeState.articleMap,
      tagMap: sharedRuntime.runtimeState.tags,
      homeArticleId: sharedRuntime.getDefaultArticleId()
    });
  }
  return createViewport360({
    host: dom.host,
    navigation: sharedRuntime.getNavigation(),
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
    runtime.unbindDelegation = sharedRuntime.bindLinkDelegation(runtime.activeViewportInstance.articlePane);

    const navigation = sharedRuntime.getNavigation();
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
    button.addEventListener("click", () => activateProfile(profileKey));
    dom.buttons.appendChild(button);
  });

  activateProfile(defaultViewport);
}

async function start() {
  const profileConfig = await loadProfiles();
  runtime.profiles = profileConfig.profiles || {};
  renderControls(profileConfig.defaultViewport || "1080");
}

start().catch((error) => {
  mountErrorIntoPane(dom.host, "Lab startup failed: " + error.message);
});
