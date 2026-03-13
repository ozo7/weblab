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

export function createTagPool(options) {
  const source = options && options.tagMap && typeof options.tagMap === "object" ? options.tagMap : {};
  const allTags = Object.keys(source).sort((a, b) => a.localeCompare(b));
  const allTagSet = new Set(allTags);
  const state = {
    selected: new Set()
  };
  const subscribers = new Set();

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep tag pool resilient to one broken subscriber.
      }
    });
  }

  function readState() {
    return {
      allTags: allTags.slice(),
      selectedTags: Array.from(state.selected)
    };
  }

  function selectTag(tag) {
    if (!allTagSet.has(tag) || state.selected.has(tag)) {
      return false;
    }
    state.selected.add(tag);
    publish({ type: "select", tag });
    return true;
  }

  function deselectTag(tag) {
    if (!state.selected.has(tag)) {
      return false;
    }
    state.selected.delete(tag);
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
    if (!state.selected.size) {
      return;
    }
    state.selected = new Set();
    publish({ type: "clear" });
  }

  function reset() {
    state.selected = new Set(allTags);
    publish({ type: "reset" });
  }

  function createSnapshot() {
    return {
      selectedTags: Array.from(state.selected)
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    state.selected = new Set(uniqueStringList(snapshot.selectedTags || []).filter((tag) => allTagSet.has(tag)));
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
