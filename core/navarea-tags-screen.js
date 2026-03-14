import { getReadableTextColor } from "./color-schemes.js";

export function createTagsScreen(options) {
  const classes = options && options.classes ? options.classes : {};
  const queue = Array.isArray(options && options.queue) ? options.queue : [];
  const selectedId = options && typeof options.selectedArticleId === "string" ? options.selectedArticleId : null;
  const selectedTagColors = options && options.selectedTagColors && typeof options.selectedTagColors === "object"
    ? options.selectedTagColors
    : {};
  const getSelectedTagsForArticle = options && typeof options.getSelectedTagsForArticle === "function"
    ? options.getSelectedTagsForArticle
    : () => [];
  const getAllTags = options && typeof options.getAllTags === "function" ? options.getAllTags : () => [];
  const getSelectedTags = options && typeof options.getSelectedTags === "function" ? options.getSelectedTags : () => [];
  const onOpenArticle = options && typeof options.onOpenArticle === "function" ? options.onOpenArticle : () => {};
  const onToggleTag = options && typeof options.onToggleTag === "function" ? options.onToggleTag : () => {};
  const onClearTags = options && typeof options.onClearTags === "function" ? options.onClearTags : () => {};
  const createButton = options && typeof options.createButton === "function"
    ? options.createButton
    : (label, className, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = label;
      button.addEventListener("click", onClick);
      return button;
    };
  const articleMap = options && options.articleMap instanceof Map ? options.articleMap : null;
  const showPager = options && options.showPager === true;

  const wrap = document.createElement("div");
  wrap.className = typeof classes.wrap === "string" ? classes.wrap : "";

  const head = document.createElement("div");
  head.className = typeof classes.head === "string" ? classes.head : "";
  head.textContent = typeof options.headText === "string" ? options.headText : "Pages to read, selected by tags:";
  wrap.appendChild(head);

  const queueList = document.createElement("div");
  queueList.className = typeof classes.queueList === "string" ? classes.queueList : "";
  if (!queue.length) {
    const empty = document.createElement("div");
    empty.className = typeof classes.empty === "string" ? classes.empty : "";
    empty.textContent = typeof options.emptyText === "string" ? options.emptyText : "No selected pages.";
    queueList.appendChild(empty);
  } else {
    queue.forEach((articleId) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = (typeof classes.queueItem === "string" ? classes.queueItem : "") + (articleId === selectedId ? " active" : "");
      item.addEventListener("click", () => onOpenArticle(articleId));

      const label = document.createElement("span");
      label.className = typeof classes.queueLabel === "string" ? classes.queueLabel : "";
      const article = articleMap && articleMap.has(articleId) ? articleMap.get(articleId) : null;
      label.textContent = article && article.title
        ? article.title
        : articleId;
      item.appendChild(label);

      const stripeWrap = document.createElement("span");
      stripeWrap.className = typeof classes.queueStripes === "string" ? classes.queueStripes : "";
      const selectedTagsFromPool = getSelectedTagsForArticle(articleId);
      selectedTagsFromPool.forEach((tag) => {
        const stripe = document.createElement("span");
        stripe.className = typeof classes.queueStripe === "string" ? classes.queueStripe : "";
        stripe.style.backgroundColor = selectedTagColors[tag] || "#111111";
        stripe.title = tag;
        stripeWrap.appendChild(stripe);
      });
      item.appendChild(stripeWrap);
      queueList.appendChild(item);
    });
  }
  wrap.appendChild(queueList);

  const controls = document.createElement("div");
  controls.className = typeof classes.controls === "string" ? classes.controls : "";

  if (showPager) {
    const currentIndex = queue.indexOf(selectedId);
    const hasCurrentInQueue = currentIndex >= 0;
    const prevId = hasCurrentInQueue && currentIndex > 0 ? queue[currentIndex - 1] : null;
    const nextId = hasCurrentInQueue
      ? (currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null)
      : (queue.length ? queue[0] : null);

    const prevButton = createButton("<", typeof classes.pagerButton === "string" ? classes.pagerButton : "", () => {
      if (prevId) {
        onOpenArticle(prevId);
      }
    });
    prevButton.disabled = !prevId;
    controls.appendChild(prevButton);

    const nextButton = createButton(">", typeof classes.pagerButton === "string" ? classes.pagerButton : "", () => {
      if (nextId) {
        onOpenArticle(nextId);
      }
    });
    nextButton.disabled = !nextId;
    controls.appendChild(nextButton);
  }

  const selectedCount = document.createElement("div");
  selectedCount.className = typeof classes.selectedCount === "string" ? classes.selectedCount : "";
  selectedCount.textContent = "Selected: " + queue.length;
  controls.appendChild(selectedCount);

  const selectedTags = new Set(getSelectedTags());
  const clearTags = createButton("Clear", typeof classes.clearButton === "string" ? classes.clearButton : "", () => {
    onClearTags();
  });
  clearTags.disabled = selectedTags.size === 0;
  controls.appendChild(clearTags);

  wrap.appendChild(controls);

  const tagWrap = document.createElement("div");
  tagWrap.className = typeof classes.tagWrap === "string" ? classes.tagWrap : "";
  const tagHead = document.createElement("div");
  tagHead.className = typeof classes.tagHead === "string" ? classes.tagHead : "";
  tagHead.textContent = "Tag pool:";
  tagWrap.appendChild(tagHead);

  const tagList = document.createElement("div");
  tagList.className = typeof classes.tagList === "string" ? classes.tagList : "";
  getAllTags().forEach((tag) => {
    const color = selectedTagColors[tag];
    const tagButton = createButton(
      tag,
      (typeof classes.tagButton === "string" ? classes.tagButton : "") + (selectedTags.has(tag) ? " active" : ""),
      () => onToggleTag(tag)
    );
    if (color && selectedTags.has(tag)) {
      tagButton.style.borderColor = color;
      tagButton.style.backgroundColor = color;
      tagButton.style.color = getReadableTextColor(color);
    }
    tagList.appendChild(tagButton);
  });
  tagWrap.appendChild(tagList);
  wrap.appendChild(tagWrap);

  if (typeof options.renderAfterTagPool === "function") {
    const extra = options.renderAfterTagPool({ queue, selectedId, selectedTags, wrap, controls });
    if (extra instanceof Node) {
      wrap.appendChild(extra);
    }
  }

  return wrap;
}
