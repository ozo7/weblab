import { mountErrorIntoPane } from "../core/content.js";
import { createSharedRuntimeSession } from "../core/shared-runtime.js";
import { ensureStyleLoaded } from "../core/style-loader.js";
import { createViewport1080 } from "../viewports/viewport-1080.js";

const host = document.getElementById("appViewportHost");

const runtime = {
  profile: null,
  activeStyleNode: null,
  activeViewport: null,
  unbindDelegation: null
};

const sharedRuntime = createSharedRuntimeSession({
  useNavigationObject: true,
  getActivePane() {
    return runtime.activeViewport ? runtime.activeViewport.articlePane : null;
  }
});

async function loadProfiles() {
  const response = await fetch("../config/viewport-profiles.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Missing config/viewport-profiles.json");
  }
  return response.json();
}

async function ensureViewportStyle(styleFile) {
  const href = "../styles/" + styleFile;
  await ensureStyleLoaded(runtime, href);
}

function mountViewport() {
  if (runtime.activeViewport) {
    runtime.activeViewport.teardown();
    runtime.activeViewport = null;
  }
  if (runtime.unbindDelegation) {
    runtime.unbindDelegation();
    runtime.unbindDelegation = null;
  }

  const navigation = sharedRuntime.getNavigationObject();
  runtime.activeViewport = createViewport1080({
    host,
    navigation,
    siteMap: sharedRuntime.getSiteMap(),
    tagPool: sharedRuntime.getTagPool(),
    pagingQueue: sharedRuntime.getPagingQueue(),
    configuration: sharedRuntime.getConfiguration(),
    homeArticleId: sharedRuntime.getDefaultArticleId()
  });
  runtime.unbindDelegation = sharedRuntime.bindLinkDelegation(runtime.activeViewport.articlePane, navigation);
}

async function start() {
  const profileConfig = await loadProfiles();
  runtime.profile = profileConfig.profiles && profileConfig.profiles["1080"]
    ? profileConfig.profiles["1080"]
    : null;
  if (!runtime.profile) {
    throw new Error("Missing 1080 profile in config/viewport-profiles.json");
  }

  host.style.width = runtime.profile.width + "px";
  host.style.height = "";
  await ensureViewportStyle(runtime.profile.style);

  await sharedRuntime.ensureLoaded();
  await sharedRuntime.getSettingsStore().load();
  mountViewport();

  const navigation = sharedRuntime.getNavigationObject();
  const current = navigation.readState().selectedArticleId;
  if (current) {
    navigation.openArticleById(current);
    return;
  }

  const fallback = sharedRuntime.getDefaultArticleId();
  if (fallback) {
    navigation.openArticleById(fallback);
  }
}

start().catch((error) => {
  mountErrorIntoPane(host, "App startup failed: " + error.message);
});
