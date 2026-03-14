import {
  BASE_COLOR_SCHEMES,
  getReadableTextColor,
  normalizePastelBaseColor,
  resolveColorSchemes
} from "./color-schemes.js";

const ACTIVE_SCHEME_KEYS = new Set(["minty-premature"]);
const FALLBACK_SCHEME_KEY = "minty-premature";
const VIEWPORT_MODES = new Set(["auto", "static-360", "static-720", "static-1080"]);

export function createConfigurationObject(options) {
  const subscribers = new Set();
  const defaultSchemeCandidate = options && options.defaultSchemeKey;
  const defaultSchemeKey = typeof defaultSchemeCandidate === "string" && ACTIVE_SCHEME_KEYS.has(defaultSchemeCandidate)
    ? defaultSchemeCandidate
    : FALLBACK_SCHEME_KEY;
  const state = {
    colorSchemesVisible: false,
    selectedSchemeKey: defaultSchemeKey,
    pastelBaseColor: normalizePastelBaseColor(options && options.pastelBaseColor, "#B76DC9"),
    viewportMode: VIEWPORT_MODES.has(options && options.viewportMode) ? options.viewportMode : "auto"
  };

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep configuration object resilient to one broken subscriber.
      }
    });
  }

  function getSchemeDefinitions() {
    return resolveColorSchemes(state.pastelBaseColor);
  }

  function getSelectedScheme() {
    const all = getSchemeDefinitions();
    return all.find((scheme) => scheme.key === state.selectedSchemeKey) || all[0];
  }

  function readState() {
    const selected = getSelectedScheme();
    return {
      colorSchemesVisible: state.colorSchemesVisible,
      selectedSchemeKey: state.selectedSchemeKey,
      pastelBaseColor: state.pastelBaseColor,
      viewportMode: state.viewportMode,
      viewportModes: ["auto", "static-360", "static-720", "static-1080"],
      schemes: getSchemeDefinitions(),
      selectedSchemePreview: selected ? selected.preview : null,
      selectedSchemeLabel: selected ? selected.label : ""
    };
  }

  function setColorSchemesVisible(visible) {
    const next = Boolean(visible);
    if (state.colorSchemesVisible === next) {
      return next;
    }
    state.colorSchemesVisible = next;
    publish({ type: "set-color-schemes-visible", visible: next });
    return next;
  }

  function toggleColorSchemesVisible() {
    return setColorSchemesVisible(!state.colorSchemesVisible);
  }

  function setSelectedScheme(key) {
    if (!BASE_COLOR_SCHEMES.some((scheme) => scheme.key === key) || !ACTIVE_SCHEME_KEYS.has(key)) {
      return false;
    }
    if (state.selectedSchemeKey === key) {
      return true;
    }
    state.selectedSchemeKey = key;
    publish({ type: "set-selected-scheme", key });
    return true;
  }

  function setPastelBaseColor(color) {
    const normalized = normalizePastelBaseColor(color, state.pastelBaseColor);
    if (state.pastelBaseColor === normalized) {
      return normalized;
    }
    state.pastelBaseColor = normalized;
    publish({ type: "set-pastel-base-color", color: normalized });
    return normalized;
  }

  function setViewportMode(mode) {
    const next = typeof mode === "string" && VIEWPORT_MODES.has(mode) ? mode : "auto";
    if (state.viewportMode === next) {
      return next;
    }
    state.viewportMode = next;
    publish({ type: "set-viewport-mode", mode: next });
    return next;
  }

  function createSnapshot() {
    return {
      colorSchemesVisible: state.colorSchemesVisible,
      selectedSchemeKey: state.selectedSchemeKey,
      pastelBaseColor: state.pastelBaseColor,
      viewportMode: state.viewportMode
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    state.colorSchemesVisible = Boolean(snapshot.colorSchemesVisible);
    if (
      typeof snapshot.selectedSchemeKey === "string" &&
      BASE_COLOR_SCHEMES.some((scheme) => scheme.key === snapshot.selectedSchemeKey) &&
      ACTIVE_SCHEME_KEYS.has(snapshot.selectedSchemeKey)
    ) {
      state.selectedSchemeKey = snapshot.selectedSchemeKey;
    } else {
      state.selectedSchemeKey = FALLBACK_SCHEME_KEY;
    }
    state.pastelBaseColor = normalizePastelBaseColor(snapshot.pastelBaseColor, state.pastelBaseColor);
    state.viewportMode = typeof snapshot.viewportMode === "string" && VIEWPORT_MODES.has(snapshot.viewportMode)
      ? snapshot.viewportMode
      : "auto";
    publish({ type: "load-snapshot" });
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  return {
    getSchemeDefinitions,
    getSelectedScheme,
    setSelectedScheme,
    setPastelBaseColor,
    setViewportMode,
    setColorSchemesVisible,
    toggleColorSchemesVisible,
    createSnapshot,
    loadSnapshot,
    subscribe,
    readState,
    getReadableTextColor
  };
}
