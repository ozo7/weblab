function ensureObject(value) {
  return value && typeof value === "object" ? value : {};
}

export async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load JSON: " + path);
  }
  return response.json();
}

export async function loadContentCatalog(sourceFolder) {
  const website = await loadJson(sourceFolder + "/website.json");
  const tags = await loadJson(sourceFolder + "/tags.json").catch(() => ({ tags: [] }));
  const runtime = await loadJson(sourceFolder + "/runtime.json").catch(() => ({}));
  return { website, tags, runtime };
}

export function buildArticleMap(topLevel, sourceFolder) {
  const map = new Map();

  function walk(entries) {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      if (typeof entry.articleId === "string") {
        const id = entry.articleId;
        map.set(id, {
          id,
          title: typeof entry.title === "string" && entry.title.trim()
            ? entry.title.trim()
            : (typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : id),
          path: sourceFolder + "/articles/" + id + ".htm"
        });
      }
      walk(entry.children);
    });
  }

  walk(topLevel);
  return map;
}

export function getLandingArticleId(website, articleMap) {
  const meta = ensureObject(website && website.meta);
  if (typeof meta.landingArticleId === "string" && articleMap.has(meta.landingArticleId)) {
    return meta.landingArticleId;
  }
  const first = articleMap.keys().next();
  return first.done ? null : first.value;
}

export async function ensureExportAssetsLoaded(sourceFolder) {
  const cssId = "weblab-export-css";
  const jsId = "weblab-export-js";
  const cssHref = sourceFolder + "/export.css";
  const jsSrc = sourceFolder + "/export.js";

  let cssNode = document.getElementById(cssId);
  if (!cssNode) {
    cssNode = document.createElement("link");
    cssNode.id = cssId;
    cssNode.rel = "stylesheet";
    cssNode.href = cssHref;
    document.head.appendChild(cssNode);
  } else if (cssNode.getAttribute("href") !== cssHref) {
    cssNode.setAttribute("href", cssHref);
  }

  let jsNode = document.getElementById(jsId);
  if (!jsNode) {
    jsNode = document.createElement("script");
    jsNode.id = jsId;
    jsNode.src = jsSrc;
    jsNode.defer = true;
    document.head.appendChild(jsNode);
    await new Promise((resolve, reject) => {
      jsNode.addEventListener("load", resolve, { once: true });
      jsNode.addEventListener("error", () => reject(new Error("Failed to load export.js")), { once: true });
    });
  }
}

function stripEdgeWhitespace(node) {
  while (node.firstChild && node.firstChild.nodeType === Node.TEXT_NODE && !node.firstChild.nodeValue.trim()) {
    node.removeChild(node.firstChild);
  }
  while (node.lastChild && node.lastChild.nodeType === Node.TEXT_NODE && !node.lastChild.nodeValue.trim()) {
    node.removeChild(node.lastChild);
  }
}

function isExternalOrSpecialUrl(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);
}

function normalizeLocalUrl(value) {
  if (typeof value !== "string") {
    return value;
  }
  const original = value.trim();
  if (!original || isExternalOrSpecialUrl(original)) {
    return original;
  }

  const match = original.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!match) {
    return original;
  }

  const path = match[1] || "";
  const query = match[2] || "";
  const hash = match[3] || "";

  const normalizedPath = path
    .split("/")
    .map((segment) => {
      if (!segment || segment === "." || segment === "..") {
        return segment;
      }
      try {
        return decodeURIComponent(segment);
      } catch (_) {
        return segment;
      }
    })
    .join("/");

  return normalizedPath + query + hash;
}

function normalizeArticleAssetUrls(container) {
  if (!container || typeof container.querySelectorAll !== "function") {
    return;
  }

  const attributeTargets = [
    { selector: "img[src]", attribute: "src" },
    { selector: "source[src]", attribute: "src" },
    { selector: "audio[src]", attribute: "src" },
    { selector: "video[src]", attribute: "src" },
    { selector: "video[poster]", attribute: "poster" },
    { selector: "track[src]", attribute: "src" },
    { selector: "a[href]", attribute: "href" },
    { selector: "[data-src]", attribute: "data-src" }
  ];

  attributeTargets.forEach((target) => {
    container.querySelectorAll(target.selector).forEach((node) => {
      const current = node.getAttribute(target.attribute);
      if (!current) {
        return;
      }
      const normalized = normalizeLocalUrl(current);
      if (normalized !== current) {
        node.setAttribute(target.attribute, normalized);
      }
    });
  });
}

export function extractPaneMain(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pane = doc.querySelector("#pane2main");
  if (!pane) {
    return null;
  }
  stripEdgeWhitespace(pane);
  return pane;
}

export async function loadArticleHtml(article, cache) {
  if (!article || !article.path) {
    throw new Error("Invalid article descriptor");
  }
  if (cache.has(article.path)) {
    return cache.get(article.path);
  }
  const response = await fetch(article.path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed article fetch: " + article.path);
  }
  const html = await response.text();
  cache.set(article.path, html);
  return html;
}

export function mountArticleIntoPane(articlePane, html) {
  const extracted = extractPaneMain(html);
  if (!extracted) {
    throw new Error("Missing #pane2main in loaded article");
  }
  articlePane.className = extracted.className || "";
  articlePane.innerHTML = extracted.innerHTML;
  normalizeArticleAssetUrls(articlePane);
  hydrateArticleRuntime();
}

export function mountErrorIntoPane(articlePane, message) {
  articlePane.className = "";
  articlePane.innerHTML = "<p>" + message + "</p>";
}

export function hydrateArticleRuntime() {
  if (window.WebwriterAudioPlaylists && typeof window.WebwriterAudioPlaylists.hydrate === "function") {
    window.WebwriterAudioPlaylists.hydrate();
  }
}
