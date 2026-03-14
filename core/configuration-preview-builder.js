import { getReadableTextColor } from "./color-schemes.js";

function safe(value, fallback) {
  return typeof value === "string" && value ? value : fallback;
}

export function renderConfigurationPreviewPane(options) {
  const pane = options && options.pane;
  const scheme = options && options.scheme;
  const prefix = options && typeof options.classPrefix === "string" ? options.classPrefix : "";
  if (!pane || !scheme || !scheme.preview || !prefix) {
    return false;
  }

  const preview = scheme.preview;
  const accentText = getReadableTextColor(preview.accent || "#888888");
  const interactiveText = getReadableTextColor(preview.interactive || "#888888");
  const interactiveAltText = getReadableTextColor(preview.placeholder || "#888888");

  const cls = (suffix) => prefix + "-config-preview-" + suffix;
  pane.className = cls("pane");
  pane.style.background = safe(preview.surface, "#F8FCF8");
  pane.innerHTML = [
    '<div class="' + cls("stage") + '">',
    '  <div class="' + cls("card") + ' cs-preview-card" style="background:' + safe(preview.surface, "#F8FCF8") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">',
    '    <div class="' + cls("top") + '">',
    '      <span class="' + cls("btn") + ' cs-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">menus / sitemap</span>',
    '      <span class="' + cls("btn") + ' cs-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">☰</span>',
    "    </div>",
    '    <div class="' + cls("title") + '">Theme Illustration: ' + scheme.label + "</div>",
    '    <div class="' + cls("queue") + ' cs-preview-queue" style="background:' + safe(preview.layer, "#FFFFFF") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">',
    '      <div class="' + cls("qrow") + ' cs-preview-qrow" style="border-color:' + safe(preview.border, "#B8CABC") + ';">',
    "        <span>hh-home</span>",
    '        <span class="' + cls("stripe") + '" style="background:' + safe(preview.accent, "#1E88E5") + ';"></span>',
    "      </div>",
    '      <div class="' + cls("qrow") + ' cs-preview-qrow" style="border-color:' + safe(preview.border, "#B8CABC") + ';">',
    "        <span>hh-seminare</span>",
    '        <span class="' + cls("stripes") + '"><i style="background:' + safe(preview.accent, "#1E88E5") + ';"></i><i style="background:' + safe(preview.interactive, "#E5F1E8") + ';"></i></span>',
    "      </div>",
    '      <div class="' + cls("qrow") + ' cs-preview-qrow">',
    "        <span>hh-kontakt</span>",
    '        <span class="' + cls("stripe") + '" style="background:' + safe(preview.accent, "#1E88E5") + ';"></span>',
    "      </div>",
    "    </div>",
    '    <div class="' + cls("controls") + '">',
    '      <span class="' + cls("btn") + ' cs-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">&lt;</span>',
    '      <span class="' + cls("btn") + ' cs-preview-btn" style="background:' + safe(preview.interactive, "#E5F1E8") + ";color:" + interactiveText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">&gt;</span>',
    "      <span>Selected: 3</span>",
    '      <span class="' + cls("btn") + ' cs-preview-btn" style="margin-left:auto;background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + interactiveAltText + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Clear</span>',
    "    </div>",
    '    <div class="' + cls("tags") + '">',
    '      <span class="' + cls("tag") + ' cs-preview-tag active" style="background:' + safe(preview.accent, "#1E88E5") + ";color:" + accentText + ';">Seminare</span>',
    '      <span class="' + cls("tag") + ' cs-preview-tag active" style="background:' + safe(preview.accent, "#1E88E5") + ";color:" + accentText + ';">Kontakt</span>',
    '      <span class="' + cls("tag") + ' cs-preview-tag" style="background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Audio</span>',
    "    </div>",
    '    <div class="' + cls("placeholder") + ' cs-preview-placeholder" style="background:' + safe(preview.placeholder, "#EEF4EF") + ";color:" + safe(preview.text, "#17301F") + ";border-color:" + safe(preview.border, "#B8CABC") + ';">Configuration preview only (no app behavior yet).</div>',
    "  </div>",
    "</div>"
  ].join("\n");

  return true;
}
