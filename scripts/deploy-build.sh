#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_PATH="${ROOT_DIR}/prod-manifest.txt"
DIST_DIR="${ROOT_DIR}/dist"
TARBALL_PATH="${ROOT_DIR}/dist.tar.gz"

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  echo "missing manifest: ${MANIFEST_PATH}" >&2
  exit 1
fi

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

while IFS= read -r line || [[ -n "${line}" ]]; do
  entry="${line%%#*}"
  entry="${entry%"${entry##*[![:space:]]}"}"
  entry="${entry#"${entry%%[![:space:]]*}"}"
  [[ -z "${entry}" ]] && continue

  src="${ROOT_DIR}/${entry}"
  dst="${DIST_DIR}/${entry}"

  if [[ ! -e "${src}" ]]; then
    echo "manifest entry missing: ${entry}" >&2
    exit 1
  fi

  mkdir -p "$(dirname "${dst}")"
  cp -a "${src}" "${dst}"
done < "${MANIFEST_PATH}"

node - "${ROOT_DIR}" "${DIST_DIR}" <<'NODE'
const fs = require("fs");
const path = require("path");

const rootDir = process.argv[2];
const distDir = process.argv[3];
const srcExport = path.join(rootDir, "zz-export");
const dstExport = path.join(distDir, "zz-export");
const matchingPath = path.join(rootDir, "zz-migration", "matching2.txt");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(src, dst) {
  if (!fs.existsSync(src)) return;
  ensureDir(path.dirname(dst));
  fs.cpSync(src, dst, { recursive: true });
}

function collectHiddenIds(entries, out) {
  if (!Array.isArray(entries)) return;
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    if (entry.publish === false && typeof entry.articleId === "string") {
      out.add(entry.articleId);
    }
    collectHiddenIds(entry.children, out);
  });
}

function collectHiddenIdsFromMatching(text, out) {
  const lines = String(text || "").split(/\r?\n/);
  let inHidden = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith("!not to publish:")) {
      inHidden = true;
      continue;
    }
    if (!inHidden) continue;
    if (!line.startsWith("- ")) {
      inHidden = false;
      continue;
    }
    const token = line.slice(2).trim().split(/\s+/)[0];
    if (token) out.add(token);
  }
}

function pruneEntries(entries, hiddenIds) {
  if (!Array.isArray(entries)) return [];
  const out = [];
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const articleId = typeof entry.articleId === "string" ? entry.articleId : null;
    if (articleId && hiddenIds.has(articleId)) {
      return;
    }
    const next = { ...entry };
    if (Array.isArray(entry.children)) {
      next.children = pruneEntries(entry.children, hiddenIds);
    }
    out.push(next);
  });
  return out;
}

function collectIncludedIds(entries, out) {
  if (!Array.isArray(entries)) return;
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    if (typeof entry.articleId === "string") out.add(entry.articleId);
    collectIncludedIds(entry.children, out);
  });
}

if (!fs.existsSync(srcExport)) {
  throw new Error("missing source export directory: " + srcExport);
}
ensureDir(dstExport);

const websitePath = path.join(srcExport, "website.json");
if (!fs.existsSync(websitePath)) {
  throw new Error("missing website.json: " + websitePath);
}
const website = JSON.parse(fs.readFileSync(websitePath, "utf8"));
const hiddenIds = new Set(
  Array.isArray(website && website.meta && website.meta.notPublishArticleIds)
    ? website.meta.notPublishArticleIds.filter((value) => typeof value === "string" && value)
    : []
);
collectHiddenIds(website.topLevel, hiddenIds);
if (fs.existsSync(matchingPath)) {
  collectHiddenIdsFromMatching(fs.readFileSync(matchingPath, "utf8"), hiddenIds);
}

const prunedTopLevel = pruneEntries(Array.isArray(website.topLevel) ? website.topLevel : [], hiddenIds);
const includedIds = new Set();
collectIncludedIds(prunedTopLevel, includedIds);

const nextMeta = {
  ...(website.meta && typeof website.meta === "object" ? website.meta : {}),
  notPublishArticleIds: Array.from(hiddenIds).sort()
};
if (!includedIds.has(nextMeta.landingArticleId)) {
  const first = Array.from(includedIds)[0] || null;
  nextMeta.landingArticleId = first;
}

const websiteOut = {
  ...website,
  meta: nextMeta,
  topLevel: prunedTopLevel
};
fs.writeFileSync(path.join(dstExport, "website.json"), JSON.stringify(websiteOut, null, 2) + "\n", "utf8");

copyIfExists(path.join(srcExport, "export.js"), path.join(dstExport, "export.js"));
copyIfExists(path.join(srcExport, "export.css"), path.join(dstExport, "export.css"));
copyIfExists(path.join(srcExport, "aa-images"), path.join(dstExport, "aa-images"));
copyIfExists(path.join(srcExport, "aa-tables"), path.join(dstExport, "aa-tables"));

const srcArticles = path.join(srcExport, "articles");
const dstArticles = path.join(dstExport, "articles");
ensureDir(dstArticles);
includedIds.forEach((articleId) => {
  const filename = articleId + ".htm";
  const src = path.join(srcArticles, filename);
  if (fs.existsSync(src)) {
    copyIfExists(src, path.join(dstArticles, filename));
  }
});

const runtimePath = path.join(srcExport, "runtime.json");
if (fs.existsSync(runtimePath)) {
  const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
  const nextArticles = {};
  const sourceArticles = runtime && runtime.articles && typeof runtime.articles === "object" ? runtime.articles : {};
  Object.keys(sourceArticles).forEach((articleId) => {
    if (includedIds.has(articleId)) {
      nextArticles[articleId] = sourceArticles[articleId];
    }
  });
  const runtimeOut = {
    ...(runtime && typeof runtime === "object" ? runtime : {}),
    articles: nextArticles
  };
  fs.writeFileSync(path.join(dstExport, "runtime.json"), JSON.stringify(runtimeOut, null, 2) + "\n", "utf8");
}

const tagsPath = path.join(srcExport, "tags.json");
if (fs.existsSync(tagsPath)) {
  const tags = JSON.parse(fs.readFileSync(tagsPath, "utf8"));
  const out = {};
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    Object.entries(tags).forEach(([tag, ids]) => {
      const filtered = Array.isArray(ids) ? ids.filter((id) => includedIds.has(id)) : [];
      if (filtered.length > 0) out[tag] = filtered;
    });
  }
  fs.writeFileSync(path.join(dstExport, "tags.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
}

const linksPath = path.join(srcExport, "internal-links.json");
if (fs.existsSync(linksPath)) {
  const payload = JSON.parse(fs.readFileSync(linksPath, "utf8"));
  const links = Array.isArray(payload.links) ? payload.links.filter((item) => {
    const fromId = item && typeof item.sourceArticleId === "string"
      ? item.sourceArticleId
      : (item && typeof item.fromArticleId === "string" ? item.fromArticleId : null);
    const toId = item && typeof item.targetArticleId === "string"
      ? item.targetArticleId
      : (item && typeof item.toArticleId === "string" ? item.toArticleId : null);
    return (!fromId || includedIds.has(fromId)) && (!toId || includedIds.has(toId));
  }) : [];
  const brokenLinks = Array.isArray(payload.brokenLinks) ? payload.brokenLinks.filter((item) => {
    const fromId = item && typeof item.sourceArticleId === "string"
      ? item.sourceArticleId
      : (item && typeof item.fromArticleId === "string" ? item.fromArticleId : null);
    return !fromId || includedIds.has(fromId);
  }) : [];
  const inbound = {};
  if (payload && payload.inbound && typeof payload.inbound === "object") {
    Object.entries(payload.inbound).forEach(([targetId, sourceIds]) => {
      if (!includedIds.has(targetId)) return;
      inbound[targetId] = Array.isArray(sourceIds) ? sourceIds.filter((id) => includedIds.has(id)) : [];
    });
  }
  const outbound = {};
  if (payload && payload.outbound && typeof payload.outbound === "object") {
    Object.entries(payload.outbound).forEach(([sourceId, targetIds]) => {
      if (!includedIds.has(sourceId)) return;
      outbound[sourceId] = Array.isArray(targetIds) ? targetIds.filter((id) => includedIds.has(id)) : [];
    });
  }
  const out = {
    ...(payload && typeof payload === "object" ? payload : {}),
    meta: {
      ...(payload && payload.meta && typeof payload.meta === "object" ? payload.meta : {}),
      articleCount: includedIds.size,
      linkCount: links.length,
      brokenCount: brokenLinks.length
    },
    articles: Array.isArray(payload.articles)
      ? payload.articles.filter((id) => includedIds.has(id))
      : Array.from(includedIds).sort(),
    links,
    brokenLinks,
    inbound,
    outbound
  };
  fs.writeFileSync(path.join(dstExport, "internal-links.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
}

const manualSettingsPath = path.join(distDir, "config", "manual-settings.json");
if (fs.existsSync(manualSettingsPath)) {
  const manualSettings = JSON.parse(fs.readFileSync(manualSettingsPath, "utf8"));
  const nextPaths = {
    ...(manualSettings && manualSettings.paths && typeof manualSettings.paths === "object" ? manualSettings.paths : {}),
    mediaAlias: "/srv/docker/richardwili/html/files"
  };
  const nextSettings = {
    ...(manualSettings && typeof manualSettings === "object" ? manualSettings : {}),
    paths: nextPaths
  };
  fs.writeFileSync(manualSettingsPath, JSON.stringify(nextSettings, null, 2) + "\n", "utf8");
}
NODE

for forbidden in lab docs zz-migration summary.md merging-spec.md; do
  if [[ -e "${DIST_DIR}/${forbidden}" ]]; then
    echo "forbidden deployment path present: ${forbidden}" >&2
    exit 1
  fi
done

rm -f "${TARBALL_PATH}"
tar -czf "${TARBALL_PATH}" -C "${DIST_DIR}" .

echo "dist ready: ${DIST_DIR}"
echo "tarball ready: ${TARBALL_PATH}"
