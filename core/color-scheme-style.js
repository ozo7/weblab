import { resolveColorSchemes } from "./color-schemes.js";

function waitForStylesheetNode(node, timeoutMs) {
  if (!node) {
    return Promise.resolve();
  }
  if (node.sheet) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      node.removeEventListener("load", onLoad);
      node.removeEventListener("error", onError);
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const onLoad = () => finish();
    const onError = () => finish(new Error("Failed to load stylesheet: " + (node.getAttribute("href") || "")));
    const timer = setTimeout(() => finish(), timeoutMs);

    node.addEventListener("load", onLoad, { once: true });
    node.addEventListener("error", onError, { once: true });
  });
}

function getColorSchemeHref(selectedSchemeKey) {
  return selectedSchemeKey ? "/styles/colorschemes/minty-premature.css" : "";
}

function normalizeHexColor(color, fallback) {
  if (typeof color !== "string") {
    return fallback;
  }
  const value = color.trim();
  const shortHex = value.match(/^#([0-9a-f]{3})$/i);
  if (shortHex) {
    const parts = shortHex[1].split("");
    return "#" + parts.map((part) => part + part).join("").toUpperCase();
  }
  const longHex = value.match(/^#([0-9a-f]{6})$/i);
  if (longHex) {
    return "#" + longHex[1].toUpperCase();
  }
  return fallback;
}

function parseHex(hex) {
  const normalized = normalizeHexColor(hex, "#17301F");
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function toRgba(hex, alpha) {
  const rgb = parseHex(hex);
  return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
}

function tint(hex, ratio) {
  const rgb = parseHex(hex);
  const n = Math.max(0, Math.min(1, Number(ratio) || 0));
  const r = Math.round(rgb.r + (255 - rgb.r) * n);
  const g = Math.round(rgb.g + (255 - rgb.g) * n);
  const b = Math.round(rgb.b + (255 - rgb.b) * n);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function shade(hex, ratio) {
  const rgb = parseHex(hex);
  const n = Math.max(0, Math.min(1, Number(ratio) || 0));
  const r = Math.round(rgb.r * (1 - n));
  const g = Math.round(rgb.g * (1 - n));
  const b = Math.round(rgb.b * (1 - n));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function buildSchemePreview(selectedSchemeKey, pastelBaseColor) {
  const schemes = resolveColorSchemes(pastelBaseColor);
  const selected = schemes.find((scheme) => scheme && scheme.key === selectedSchemeKey) || schemes[0];
  return selected && selected.preview ? selected.preview : null;
}

function buildOverrideCss(selectedSchemeKey, pastelBaseColor) {
  const preview = buildSchemePreview(selectedSchemeKey, pastelBaseColor);
  if (!preview) {
    return "";
  }
  const surface = normalizeHexColor(preview.surface, "#F8FCF8");
  const layer = normalizeHexColor(preview.layer, "#FFFFFF");
  const text = normalizeHexColor(preview.text, "#17301F");
  const border = normalizeHexColor(preview.border, "#B8CABC");
  const interactive = normalizeHexColor(preview.interactive, "#E5F1E8");
  const accent = normalizeHexColor(preview.accent, "#7DA88A");
  const placeholder = normalizeHexColor(preview.placeholder, tint(surface, 0.2));
  const borderSoft = tint(border, 0.45);
  const textSoft = tint(text, 0.28);
  const bodyBg = shade(surface, 0.03);
  const hostBg = shade(layer, 0.015);
  const railStart = tint(surface, 0.04);
  const railEnd = tint(surface, 0.11);
  const fabBg = toRgba(layer, 0.96);
  const fabShadow = "0 8px 16px " + toRgba(text, 0.14);
  const overlayBg = toRgba(layer, 0.98);
  const panelHeadBg = tint(interactive, 0.2);
  const softDivider = toRgba(text, 0.18);
  const glassBg = toRgba(surface, 0.96);
  const glassBorder = toRgba(text, 0.22);
  const glassShadow = "0 6px 14px " + toRgba(text, 0.16);
  const scrollTrack = tint(surface, 0.08);
  const scrollThumb = border;
  const scrollThumbHover = accent;
  const link = accent;
  const linkHover = shade(accent, 0.28);
  const linkVisited = tint(shade(accent, 0.36), 0.28);
  const depth1 = toRgba(text, 0.15);
  const depth2 = toRgba(text, 0.30);
  const depth3 = toRgba(text, 0.45);
  const depth4 = toRgba(text, 0.60);

  return [
    ":root {",
    "  --mint-surface: " + surface + ";",
    "  --mint-layer: " + layer + ";",
    "  --mint-body-bg: " + bodyBg + ";",
    "  --mint-host-bg: " + hostBg + ";",
    "  --mint-text: " + text + ";",
    "  --mint-text-soft: " + textSoft + ";",
    "  --mint-border: " + border + ";",
    "  --mint-border-soft: " + borderSoft + ";",
    "  --mint-interactive: " + interactive + ";",
    "  --mint-interactive-strong: " + tint(interactive, 0.12) + ";",
    "  --mint-rail-grad-start: " + railStart + ";",
    "  --mint-rail-grad-end: " + railEnd + ";",
    "  --mint-fab-bg: " + fabBg + ";",
    "  --mint-fab-shadow: " + fabShadow + ";",
    "  --mint-chevron: " + accent + ";",
    "  --mint-overlay-bg: " + overlayBg + ";",
    "  --mint-panel-head-bg: " + panelHeadBg + ";",
    "  --mint-soft-divider: " + softDivider + ";",
    "  --mint-glass-bg: " + glassBg + ";",
    "  --mint-glass-border: " + glassBorder + ";",
    "  --mint-glass-shadow: " + glassShadow + ";",
    "  --mint-scroll-track: " + scrollTrack + ";",
    "  --mint-scroll-thumb: " + scrollThumb + ";",
    "  --mint-scroll-thumb-hover: " + scrollThumbHover + ";",
    "  --mint-link: " + link + ";",
    "  --mint-link-hover: " + linkHover + ";",
    "  --mint-link-visited: " + linkVisited + ";",
    "  --mint-depth-1: " + depth1 + ";",
    "  --mint-depth-2: " + depth2 + ";",
    "  --mint-depth-3: " + depth3 + ";",
    "  --mint-depth-4: " + depth4 + ";",
    "}",
    ".cs-menu-item.active,",
    ".cs-list-btn.active,",
    ".cs-chip-btn.active,",
    ".cs-nav-btn.active,",
    ".cs-action-btn.active,",
    ".cs-mini-nav-btn.active { border-color: " + accent + "; }",
    ".cs-empty { border-color: " + border + "; background: " + placeholder + "; color: " + textSoft + "; }",
    ".cs-menu-list { box-shadow: 0 4px 16px " + toRgba(text, 0.2) + "; border-color: " + border + "; }",
    ".cs-queue-stripe { background: " + accent + "; }"
  ].join("\n");
}

export async function ensureColorSchemeStyleLoaded(state, selectedSchemeKey, options) {
  const timeoutMs = Number(options && options.timeoutMs) > 0 ? Number(options.timeoutMs) : 3000;
  const pastelBaseColor = options && typeof options.pastelBaseColor === "string"
    ? options.pastelBaseColor
    : "#B76DC9";
  const owner = state || {};
  const href = getColorSchemeHref(selectedSchemeKey);
  const activeNode = owner.activeColorSchemeStyleNode || null;
  const activeOverride = owner.activeColorSchemeOverrideNode || null;

  if (!href) {
    if (activeNode && activeNode.parentNode) {
      activeNode.parentNode.removeChild(activeNode);
    }
    if (activeOverride && activeOverride.parentNode) {
      activeOverride.parentNode.removeChild(activeOverride);
    }
    owner.activeColorSchemeStyleNode = null;
    owner.activeColorSchemeOverrideNode = null;
    return null;
  }

  if (activeNode && activeNode.getAttribute("href") === href) {
    await waitForStylesheetNode(activeNode, timeoutMs);
    const cssText = buildOverrideCss(selectedSchemeKey, pastelBaseColor);
    const override = activeOverride && activeOverride.parentNode
      ? activeOverride
      : document.createElement("style");
    if (!activeOverride || !activeOverride.parentNode) {
      document.head.appendChild(override);
    }
    override.textContent = cssText;
    owner.activeColorSchemeOverrideNode = override;
    return activeNode;
  }

  if (activeNode && activeNode.parentNode) {
    activeNode.parentNode.removeChild(activeNode);
  }

  const node = document.createElement("link");
  node.rel = "stylesheet";
  node.href = href;
  document.head.appendChild(node);
  owner.activeColorSchemeStyleNode = node;
  await waitForStylesheetNode(node, timeoutMs);

  const cssText = buildOverrideCss(selectedSchemeKey, pastelBaseColor);
  const override = activeOverride && activeOverride.parentNode
    ? activeOverride
    : document.createElement("style");
  if (!activeOverride || !activeOverride.parentNode) {
    document.head.appendChild(override);
  }
  override.textContent = cssText;
  owner.activeColorSchemeOverrideNode = override;
  return node;
}
