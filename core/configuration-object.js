import {
  BASE_COLOR_SCHEMES,
  getReadableTextColor,
  normalizePastelBaseColor,
  resolveColorSchemes
} from "./color-schemes.js";

export function createConfigurationObject(options) {
  const subscribers = new Set();
  const defaultSchemeKey = BASE_COLOR_SCHEMES.some((scheme) => scheme.key === (options && options.defaultSchemeKey))
    ? options.defaultSchemeKey
    : "dark";
  const state = {
    colorSchemesVisible: false,
    selectedSchemeKey: defaultSchemeKey,
    pastelBaseColor: normalizePastelBaseColor(options && options.pastelBaseColor, "#B76DC9")
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
    if (!BASE_COLOR_SCHEMES.some((scheme) => scheme.key === key)) {
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

  function createSnapshot() {
    return {
      colorSchemesVisible: state.colorSchemesVisible,
      selectedSchemeKey: state.selectedSchemeKey,
      pastelBaseColor: state.pastelBaseColor
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    state.colorSchemesVisible = Boolean(snapshot.colorSchemesVisible);
    if (typeof snapshot.selectedSchemeKey === "string" && BASE_COLOR_SCHEMES.some((scheme) => scheme.key === snapshot.selectedSchemeKey)) {
      state.selectedSchemeKey = snapshot.selectedSchemeKey;
    }
    state.pastelBaseColor = normalizePastelBaseColor(snapshot.pastelBaseColor, state.pastelBaseColor);
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
    setColorSchemesVisible,
    toggleColorSchemesVisible,
    createSnapshot,
    loadSnapshot,
    subscribe,
    readState,
    getReadableTextColor
  };
}
