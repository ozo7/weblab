function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error("Request failed: " + response.status);
  }
  return response.json();
}

const LOCAL_STORAGE_KEY = "webviewer:user-settings:v1";

function createEmptySettings() {
  return {
    app: {
      viewportSessions: {},
      objects: {}
    }
  };
}

function ensureShape(target) {
  if (!isObject(target.app)) {
    target.app = {};
  }
  if (!isObject(target.app.viewportSessions)) {
    target.app.viewportSessions = {};
  }
  if (!isObject(target.app.objects)) {
    target.app.objects = {};
  }
  return target;
}

function hasMeaningfulLocalUserState(snapshot) {
  if (!snapshot || !snapshot.app) {
    return false;
  }
  const viewportSessions = isObject(snapshot.app.viewportSessions) ? snapshot.app.viewportSessions : {};
  const objects = isObject(snapshot.app.objects) ? snapshot.app.objects : {};
  return Object.keys(viewportSessions).length > 0 || Object.keys(objects).length > 0;
}

function readLocalStorageSettings() {
  if (typeof window === "undefined" || !window.localStorage) {
    return createEmptySettings();
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return createEmptySettings();
    }
    const parsed = JSON.parse(raw);
    return ensureShape(isObject(parsed) ? parsed : createEmptySettings());
  } catch (_) {
    return createEmptySettings();
  }
}

function writeLocalStorageSettings(nextSettings) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextSettings));
    return true;
  } catch (_) {
    return false;
  }
}

export function createSettingsStore() {
  let settings = createEmptySettings();
  let localSettings = createEmptySettings();
  let remoteSettings = createEmptySettings();
  let persistTimer = null;
  let pendingPersist = Promise.resolve();
  let dirtyLocal = false;
  let dirtyRemote = false;
  let localUserStateAvailable = false;

  function mergeSettings() {
    const next = createEmptySettings();
    ensureShape(localSettings);
    ensureShape(remoteSettings);

    next.app.viewportSessions = cloneJson(localSettings.app.viewportSessions);
    next.app.objects = cloneJson(localSettings.app.objects);
    delete next.app.objects.labUi;

    if (isObject(remoteSettings.app.objects.labUi)) {
      next.app.objects.labUi = cloneJson(remoteSettings.app.objects.labUi);
    }
    settings = ensureShape(next);
  }

  function migrateLegacyRemoteSettingsToLocal() {
    let changed = false;
    Object.keys(remoteSettings.app.viewportSessions).forEach((key) => {
      if (!isObject(localSettings.app.viewportSessions[key])) {
        localSettings.app.viewportSessions[key] = cloneJson(remoteSettings.app.viewportSessions[key]);
        changed = true;
      }
    });
    Object.keys(remoteSettings.app.objects).forEach((key) => {
      if (key === "labUi") {
        return;
      }
      if (!isObject(localSettings.app.objects[key])) {
        localSettings.app.objects[key] = cloneJson(remoteSettings.app.objects[key]);
        changed = true;
      }
    });
    if (changed) {
      writeLocalStorageSettings(localSettings);
    }
  }

  async function load() {
    localSettings = ensureShape(readLocalStorageSettings());
    localUserStateAvailable = hasMeaningfulLocalUserState(localSettings);
    try {
      remoteSettings = ensureShape(await fetchJson("/api/settings", { cache: "no-store" }));
    } catch (_) {
      remoteSettings = createEmptySettings();
    }
    if (localUserStateAvailable) {
      migrateLegacyRemoteSettingsToLocal();
    }
    mergeSettings();
    return cloneJson(settings);
  }

  function read() {
    mergeSettings();
    return cloneJson(settings);
  }

  function getViewportSession(viewportKey, fallback) {
    mergeSettings();
    const stored = settings.app.viewportSessions[viewportKey];
    if (!isObject(stored)) {
      return cloneJson(fallback);
    }
    return Object.assign({}, cloneJson(fallback), cloneJson(stored));
  }

  function setViewportSession(viewportKey, snapshot) {
    ensureShape(localSettings);
    localSettings.app.viewportSessions[viewportKey] = cloneJson(snapshot);
    dirtyLocal = true;
    mergeSettings();
  }

  function getObjectSnapshot(objectKey, fallback) {
    mergeSettings();
    const stored = settings.app.objects[objectKey];
    if (!isObject(stored)) {
      return cloneJson(fallback);
    }
    if (!isObject(fallback)) {
      return cloneJson(stored);
    }
    return Object.assign({}, cloneJson(fallback), cloneJson(stored));
  }

  function setObjectSnapshot(objectKey, snapshot) {
    if (objectKey === "labUi") {
      ensureShape(remoteSettings);
      remoteSettings.app.objects.labUi = cloneJson(snapshot);
      dirtyRemote = true;
    } else {
      ensureShape(localSettings);
      localSettings.app.objects[objectKey] = cloneJson(snapshot);
      dirtyLocal = true;
    }
    mergeSettings();
  }

  function hasObjectSnapshot(objectKey) {
    mergeSettings();
    return isObject(settings.app.objects[objectKey]);
  }

  function hasLocalUserState() {
    return localUserStateAvailable;
  }

  async function persistNow() {
    pendingPersist = pendingPersist.then(async () => {
      if (dirtyLocal) {
        if (writeLocalStorageSettings(localSettings)) {
          dirtyLocal = false;
        }
      }
      if (dirtyRemote) {
        const payload = cloneJson(remoteSettings);
        try {
          remoteSettings = ensureShape(await fetchJson("/api/settings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          }));
          dirtyRemote = false;
        } catch (_) {
          // Keep in-memory remote settings and retry on next persist.
        }
      }
      mergeSettings();
    });
    await pendingPersist;
  }

  function schedulePersist(delayMs) {
    if (persistTimer) {
      window.clearTimeout(persistTimer);
    }
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      persistNow();
    }, delayMs);
  }

  return {
    load,
    read,
    getViewportSession,
    setViewportSession,
    getObjectSnapshot,
    hasObjectSnapshot,
    hasLocalUserState,
    setObjectSnapshot,
    schedulePersist,
    persistNow
  };
}
