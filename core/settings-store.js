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

export function createSettingsStore() {
  let settings = null;
  let persistTimer = null;
  let pendingPersist = Promise.resolve();

  function ensureShape() {
    if (!isObject(settings)) {
      settings = {};
    }
    if (!isObject(settings.app)) {
      settings.app = {};
    }
    if (!isObject(settings.app.viewportSessions)) {
      settings.app.viewportSessions = {};
    }
    if (!isObject(settings.app.objects)) {
      settings.app.objects = {};
    }
  }

  async function load() {
    try {
      settings = await fetchJson("/api/settings", { cache: "no-store" });
    } catch (_) {
      settings = {};
    }
    ensureShape();
    return cloneJson(settings);
  }

  function read() {
    ensureShape();
    return cloneJson(settings);
  }

  function getViewportSession(viewportKey, fallback) {
    ensureShape();
    const stored = settings.app.viewportSessions[viewportKey];
    if (!isObject(stored)) {
      return cloneJson(fallback);
    }
    return Object.assign({}, cloneJson(fallback), cloneJson(stored));
  }

  function setViewportSession(viewportKey, snapshot) {
    ensureShape();
    settings.app.viewportSessions[viewportKey] = cloneJson(snapshot);
  }

  function getObjectSnapshot(objectKey, fallback) {
    ensureShape();
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
    ensureShape();
    settings.app.objects[objectKey] = cloneJson(snapshot);
  }

  function hasObjectSnapshot(objectKey) {
    ensureShape();
    return isObject(settings.app.objects[objectKey]);
  }

  async function persistNow() {
    ensureShape();
    const payload = cloneJson(settings);
    pendingPersist = pendingPersist.then(async () => {
      try {
        settings = await fetchJson("/api/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      } catch (_) {
        // Keep local in-memory settings if persistence fails.
      }
      ensureShape();
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
    setObjectSnapshot,
    schedulePersist,
    persistNow
  };
}
