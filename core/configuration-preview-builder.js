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

  const cls = (suffix) => prefix + "-config-preview-" + suffix;
  pane.className = cls("pane");
  pane.style.background = safe(preview.surface, "#F8FCF8");
  pane.innerHTML = [
    '<div class="' + cls("stage") + '">',
    '  <div class="' + cls("model") + '">',
    '    <div class="' + cls("frame") + ' cs-preview-card">',
    '      <div class="' + cls("top") + '">',
    '        <span class="' + cls("btn") + ' cs-preview-btn">menus / sitemap</span>',
    '        <span class="' + cls("btn") + ' cs-preview-btn">☰</span>',
    "      </div>",
    '      <div class="' + cls("layout") + '">',
    '        <section class="' + cls("content") + ' cs-content-host">',
    '          <div class="' + cls("article") + '">',
    '            <h1 class="' + cls("h1") + '">Mini model headline (H1)</h1>',
    '            <h2 class="' + cls("h2") + '">Secondary heading (H2)</h2>',
    '            <p class="' + cls("text") + '">This mini model reflects key real UI elements so missing theme values are visible instantly.</p>',
    '            <p class="' + cls("text") + '"><a href="#">Example content link</a> and <a href="#visited" class="is-visited">visited link sample</a>.</p>',
    '            <div class="' + cls("controls") + '">',
    '              <span class="' + cls("btn") + ' cs-preview-btn">&lt;</span>',
    '              <span class="' + cls("btn") + ' cs-preview-btn">&gt;</span>',
    '              <span>Selected: 3</span>',
    '              <span class="' + cls("btn") + ' cs-preview-btn">Clear</span>',
    "            </div>",
    '            <div class="' + cls("tags") + '">',
    '              <span class="' + cls("tag") + ' cs-preview-tag active" style="background:' + safe(preview.accent, "#1E88E5") + ";color:" + accentText + ';">Seminare</span>',
    '              <span class="' + cls("tag") + ' cs-preview-tag active" style="background:' + safe(preview.accent, "#1E88E5") + ";color:" + accentText + ';">Kontakt</span>',
    '              <span class="' + cls("tag") + ' cs-preview-tag">Audio</span>',
    "            </div>",
    '            <div class="' + cls("placeholder") + ' cs-empty">Empty/placeholder block sample</div>',
    "          </div>",
    "        </section>",
    '        <aside class="' + cls("rail") + ' cs-rail">',
    '          <div class="' + cls("title") + '">Navigation pane</div>',
    '          <div class="' + cls("queue") + ' cs-preview-queue">',
    '            <div class="' + cls("qrow") + ' cs-preview-qrow"><span>hh-home</span><span class="' + cls("stripe") + ' cs-queue-stripe"></span></div>',
    '            <div class="' + cls("qrow") + ' cs-preview-qrow"><span>hh-seminare</span><span class="' + cls("stripes") + '"><i class="cs-queue-stripe"></i><i class="cs-queue-stripe"></i></span></div>',
    '            <div class="' + cls("qrow") + ' cs-preview-qrow"><span>hh-kontakt</span><span class="' + cls("stripe") + ' cs-queue-stripe"></span></div>',
    "          </div>",
    '          <div class="' + cls("scroll-head") + '">Scrollbar preview</div>',
    '          <div class="' + cls("scroll-box") + ' cs-preview-scroll-box">',
    "            <p>Item 1</p><p>Item 2</p><p>Item 3</p><p>Item 4</p><p>Item 5</p><p>Item 6</p><p>Item 7</p><p>Item 8</p><p>Item 9</p><p>Item 10</p><p>Item 11</p><p>Item 12</p><p>Item 13</p><p>Item 14</p><p>Item 15</p><p>Item 16</p><p>Item 17</p><p>Item 18</p><p>Item 19</p><p>Item 20</p><p>Item 21</p><p>Item 22</p><p>Item 23</p><p>Item 24</p>",
    "          </div>",
    "        </aside>",
    "      </div>",
    "    </div>",
    '    <div class="' + cls("caption") + '">Live mini-model for scheme: ' + scheme.label + "</div>",
    "  </div>",
    "</div>"
  ].join("\n");

  return true;
}
