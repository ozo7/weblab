function uniqueStringList(values) {
  const seen = new Set();
  const out = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    if (typeof value !== "string" || seen.has(value)) {
      return;
    }
    seen.add(value);
    out.push(value);
  });
  return out;
}

function clampChannel(value) {
  const n = Number(value);
  if (Number.isNaN(n)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(n)));
}

function normalizeHexColor(color) {
  if (typeof color !== "string") {
    return null;
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
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const channels = rgb[1].split(",").slice(0, 3).map((part) => clampChannel(part.trim()));
    if (channels.length === 3) {
      return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
    }
  }
  return null;
}

function parseRgb(color) {
  const hex = normalizeHexColor(color);
  if (!hex) {
    return null;
  }
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  };
}

function rgbDistance(a, b) {
  if (!a || !b) {
    return 0;
  }
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luminance(rgb) {
  if (!rgb) {
    return 0;
  }
  const transform = (channel) => {
    const n = channel / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  const r = transform(rgb.r);
  const g = transform(rgb.g);
  const b = transform(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastDistance(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

function colorDistance(prevalentColor, candidateColor) {
  const prevalent = parseRgb(prevalentColor);
  const candidate = parseRgb(candidateColor);
  if (!prevalent || !candidate) {
    return 0;
  }
  const euclidean = rgbDistance(prevalent, candidate);
  const contrast = contrastDistance(prevalent, candidate) * 30;
  return euclidean + contrast;
}

function rotateFromIndex(colors, startIndex) {
  const list = Array.isArray(colors) ? colors.slice() : [];
  if (!list.length) {
    return [];
  }
  const normalizedStart = Number.isInteger(startIndex) ? startIndex : 0;
  const offset = ((normalizedStart % list.length) + list.length) % list.length;
  return list.slice(offset).concat(list.slice(0, offset));
}

function getOrderProposals(palette, prevalentColor) {
  const normalized = uniqueStringList(palette.map((color) => normalizeHexColor(color))).filter(Boolean);
  if (!normalized.length) {
    return [];
  }

  const bestEntry = normalized
    .slice()
    .sort((a, b) => colorDistance(prevalentColor, b) - colorDistance(prevalentColor, a))[0];

  const proposal1 = rotateFromIndex(normalized, normalized.indexOf(bestEntry));
  const proposal2 = [bestEntry].concat(
    normalized.filter((color) => color !== bestEntry).sort((a, b) => colorDistance(a, b) - colorDistance(b, a))
  );
  const proposal3 = normalized
    .slice()
    .sort((a, b) => colorDistance(prevalentColor, b) - colorDistance(prevalentColor, a));
  const proposal4 = [bestEntry].concat(
    normalized.filter((color) => color !== bestEntry).sort((a, b) => {
      const la = luminance(parseRgb(a));
      const lb = luminance(parseRgb(b));
      return la - lb;
    })
  );
  const proposal5 = [bestEntry].concat(
    normalized.filter((color) => color !== bestEntry).sort((a, b) => {
      const prevalent = parseRgb(prevalentColor);
      const da = rgbDistance(parseRgb(a), prevalent);
      const db = rgbDistance(parseRgb(b), prevalent);
      return (db - da) || a.localeCompare(b);
    })
  );

  return [
    { id: "greedy-rgb-contrast", label: "Greedy Max Distance", colors: proposal1 },
    { id: "greedy-contrast-first", label: "Greedy Contrast First", colors: proposal2 },
    { id: "distance-from-prevalent", label: "Distance From Prevalent", colors: proposal3 },
    { id: "luminance-ladder", label: "Luminance Ladder", colors: proposal4 },
    { id: "radial-prevalent", label: "Radial From Prevalent", colors: proposal5 }
  ];
}

export function createTagPool(options) {
  const source = options && options.tagMap && typeof options.tagMap === "object" ? options.tagMap : {};
  const allTags = Object.keys(source).sort((a, b) => a.localeCompare(b));
  const allTagSet = new Set(allTags);
  const articleOrder = uniqueStringList(
    Array.isArray(options && options.articleOrder) ? options.articleOrder : []
  );
  const articleOrderIndex = new Map();
  articleOrder.forEach((articleId, index) => {
    articleOrderIndex.set(articleId, index);
  });
  const tagToArticleIds = new Map();
  const articleToTags = new Map();
  allTags.forEach((tag) => {
    const ids = uniqueStringList(Array.isArray(source[tag]) ? source[tag] : []);
    const sortedIds = ids
      .slice()
      .sort((a, b) => (articleOrderIndex.get(a) ?? Number.MAX_SAFE_INTEGER) - (articleOrderIndex.get(b) ?? Number.MAX_SAFE_INTEGER));
    tagToArticleIds.set(tag, sortedIds);
    sortedIds.forEach((articleId) => {
      if (!articleToTags.has(articleId)) {
        articleToTags.set(articleId, []);
      }
      const tagsForArticle = articleToTags.get(articleId);
      if (!tagsForArticle.includes(tag)) {
        tagsForArticle.push(tag);
      }
    });
  });
  const paletteInput = Array.isArray(options && options.palette)
    ? options.palette
    : [
      "#111111",
      "#E53935",
      "#1E88E5",
      "#43A047",
      "#FB8C00",
      "#8E24AA",
      "#00ACC1",
      "#FDD835",
      "#6D4C41",
      "#C0CA33"
    ];
  const palette = uniqueStringList(paletteInput.map((color) => normalizeHexColor(color))).filter(Boolean).slice(0, 10);
  const prevalentColor = normalizeHexColor(options && options.prevalentColor) || "#F8FCF8";
  const startColor = palette
    .slice()
    .sort((a, b) => colorDistance(prevalentColor, b) - colorDistance(prevalentColor, a))[0] || palette[0] || "#111111";
  const startIndex = Math.max(0, palette.indexOf(startColor));
  const orderProposals = getOrderProposals(palette, prevalentColor);
  const orderedPalette = rotateFromIndex(palette, startIndex);
  const state = {
    selected: new Set(),
    selectionOrder: []
  };
  let pagingQueue = null;
  const subscribers = new Set();

  function computeSelectedTagColors() {
    const out = {};
    const selectedOrdered = state.selectionOrder.filter((tag) => state.selected.has(tag));
    selectedOrdered.forEach((tag, index) => {
      out[tag] = orderedPalette[index % orderedPalette.length] || orderedPalette[0] || "#111111";
    });
    return out;
  }

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep tag pool resilient to one broken subscriber.
      }
    });
  }

  function getPagesForSelectedTags() {
    const out = [];
    const seen = new Set();
    const orderedSelectedTags = state.selectionOrder.filter((tag) => state.selected.has(tag));
    orderedSelectedTags.forEach((tag) => {
      const ids = tagToArticleIds.get(tag) || [];
      ids.forEach((articleId) => {
        if (seen.has(articleId)) {
          return;
        }
        seen.add(articleId);
        out.push(articleId);
      });
    });
    return out;
  }

  function getSelectedTagsForArticle(articleId) {
    const tags = articleToTags.get(articleId) || [];
    return tags.filter((tag) => state.selected.has(tag));
  }

  function syncPagingQueue() {
    if (!pagingQueue || typeof pagingQueue.setPages !== "function") {
      return [];
    }
    const pageIds = getPagesForSelectedTags();
    pagingQueue.setPages(pageIds, { allowReorder: false });
    return pageIds;
  }

  function bindPagingQueue(nextPagingQueue, options) {
    pagingQueue = nextPagingQueue && typeof nextPagingQueue.setPages === "function"
      ? nextPagingQueue
      : null;
    if (pagingQueue && options && options.syncNow) {
      syncPagingQueue();
    }
  }

  function readState() {
    return {
      allTags: allTags.slice(),
      selectedTags: Array.from(state.selected),
      selectedTagColors: computeSelectedTagColors(),
      selectionOrder: state.selectionOrder.slice(),
      prevalentColor,
      startColor,
      startIndex,
      palette: palette.slice(),
      orderedPalette: orderedPalette.slice()
    };
  }

  function selectTag(tag) {
    if (!allTagSet.has(tag) || state.selected.has(tag)) {
      return false;
    }
    state.selected.add(tag);
    state.selectionOrder.push(tag);
    syncPagingQueue();
    publish({ type: "select", tag });
    return true;
  }

  function deselectTag(tag) {
    if (!state.selected.has(tag)) {
      return false;
    }
    state.selected.delete(tag);
    state.selectionOrder = state.selectionOrder.filter((entry) => entry !== tag);
    syncPagingQueue();
    publish({ type: "deselect", tag });
    return true;
  }

  function toggleTag(tag) {
    if (state.selected.has(tag)) {
      return deselectTag(tag);
    }
    return selectTag(tag);
  }

  function clear() {
    const hadSelection = state.selected.size > 0;
    state.selected = new Set();
    state.selectionOrder = [];
    if (pagingQueue && typeof pagingQueue.clear === "function") {
      pagingQueue.clear();
    } else {
      syncPagingQueue();
    }
    if (hadSelection) {
      publish({ type: "clear" });
    }
  }

  function reset() {
    state.selected = new Set(allTags);
    state.selectionOrder = allTags.slice();
    syncPagingQueue();
    publish({ type: "reset" });
  }

  function createSnapshot() {
    return {
      selectedTags: Array.from(state.selected),
      selectionOrder: state.selectionOrder.slice()
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    state.selected = new Set(uniqueStringList(snapshot.selectedTags || []).filter((tag) => allTagSet.has(tag)));
    state.selectionOrder = uniqueStringList(snapshot.selectionOrder || []).filter((tag) => state.selected.has(tag));
    state.selected.forEach((tag) => {
      if (!state.selectionOrder.includes(tag)) {
        state.selectionOrder.push(tag);
      }
    });
    syncPagingQueue();
    publish({ type: "load-snapshot" });
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  return {
    getAllTags() {
      return allTags.slice();
    },
    getSelectedTags() {
      return Array.from(state.selected);
    },
    getSelectedTagColors() {
      return computeSelectedTagColors();
    },
    getPagesForSelectedTags,
    getSelectedTagsForArticle,
    getTagColor(tag) {
      const colors = computeSelectedTagColors();
      return typeof colors[tag] === "string" ? colors[tag] : null;
    },
    getPrevalentColor() {
      return prevalentColor;
    },
    getColorPalette() {
      return palette.slice();
    },
    getStartColor() {
      return startColor;
    },
    getStartIndex() {
      return startIndex;
    },
    getOrderedPalette() {
      return orderedPalette.slice();
    },
    getColorOrderProposals() {
      return orderProposals.map((entry) => ({
        id: entry.id,
        label: entry.label,
        colors: entry.colors.slice()
      }));
    },
    bindPagingQueue,
    selectTag,
    deselectTag,
    toggleTag,
    clear,
    reset,
    createSnapshot,
    loadSnapshot,
    subscribe,
    readState
  };
}
