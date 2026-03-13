(function initWebwriterFeatureRenderers(globalScope) {
  class ImageFeatureRenderer {
    constructor(deps) {
      this.escapeHtml = deps.escapeHtml;
      this.imageDomId = deps.imageDomId;
      this.normalizeImageWidthPx = deps.normalizeImageWidthPx;
      this.normalizeImageResizeMode = deps.normalizeImageResizeMode;
      this.normalizeImageAspectRatio = deps.normalizeImageAspectRatio;
      this.normalizeImagePixelSize = deps.normalizeImagePixelSize;
      this.normalizeImagePosition = deps.normalizeImagePosition;
      this.computeInlineFlowSpacing = deps.computeInlineFlowSpacing;
      this.renderTableFootnotes = deps.renderTableFootnotes;
    }

    renderPlacedImage(item, context) {
      const { file, key, layout } = item;
      const {
        topic,
        placementByKey,
        imageMeta,
        imageBorderByKey,
      } = context;
      const name = file.split("/").pop() || file;
      const placement = placementByKey.get(key);
      const imgWidthPx = this.normalizeImageWidthPx(placement?.imgWidthPx);
      const resizeMode = this.normalizeImageResizeMode(placement?.resizeMode);
      const lockedAspectRatio = this.normalizeImageAspectRatio(placement?.lockedAspectRatio);
      const hasLockedRatio = false;
      const freeHeightPx = this.normalizeImagePixelSize(placement?.freeHeightPx);
      const widthPx = this.normalizeImageWidthPx(placement?.imgWidthPx);
      const imgStyle = resizeMode === "free"
        ? (freeHeightPx
          ? ` style="width:${widthPx}px; height:${freeHeightPx}px;"`
          : ` style="width:${widthPx}px; height:auto;"`)
        : ` style="width:${widthPx}px; height:auto;"`;
      const ratioStyle = hasLockedRatio ? `; --image-locked-ratio:${lockedAspectRatio}` : "";
      const manualFootnote = String(imageMeta[key]?.footnote || "").replace(/\r\n/g, "\n");
      const placementPosition = this.normalizeImagePosition(placement?.position);
      const effectiveLayout = placementPosition !== "inside" && (layout === "float-left" || layout === "float-right")
        ? (layout === "float-left" ? "block-left" : "block-right")
        : layout;
      const supportsSideFootnote = effectiveLayout === "block-left" || effectiveLayout === "block-right";
      const isSideFootnote = supportsSideFootnote && Boolean(placement?.footnoteSide);
      const rawFootnotesHtml = manualFootnote.length > 0
        ? this.renderTableFootnotes(manualFootnote, [], 64, { allowPrimaryAutoMerge: false, preserveEmptyAutoRows: true })
        : "";
      const footnotesHtml = (supportsSideFootnote || rawFootnotesHtml)
        ? `
        <div class="image-footnote-wrap${isSideFootnote ? " is-side" : ""}">
          ${supportsSideFootnote ? `<button type="button" class="image-footnote-toggle" data-image-key="${this.escapeHtml(key)}" title="${isSideFootnote ? "Move footnote below image" : "Move footnote to side"}">${isSideFootnote ? "Footnote: Below" : "Footnote: Side"}</button>` : ""}
          ${rawFootnotesHtml}
        </div>
      `
        : "";
      const border = imageBorderByKey?.get(key) || { enabled: false, widthPx: 0, color: "#4d5b68", radiusPx: 6 };
      const borderStyle = `; --image-border-width:${border.enabled ? border.widthPx : 0}px; --image-border-color:${this.escapeHtml(border.color || "#4d5b68")}; --image-border-radius:${border.radiusPx ?? 6}px`;
      return `
      <figure class="article-image layout-${effectiveLayout} resize-mode-${resizeMode}${hasLockedRatio ? " has-locked-ratio" : ""}${isSideFootnote ? " footnote-side" : ""}" data-image-key="${this.escapeHtml(key)}" draggable="true" style="--image-size-pct:${imgWidthPx}px${ratioStyle}${borderStyle}">
        <span class="placed-item-drag-handle image-drag-handle" data-image-key="${this.escapeHtml(key)}" draggable="true" title="Drag image">DRAG</span>
        <button type="button" class="thumb-remove-btn card-remove-btn image-placed-remove-btn" data-image-key="${this.escapeHtml(key)}" title="Remove image from article">x</button>
        <img class="article-image-asset" id="${this.escapeHtml(this.imageDomId(topic, file))}" src="${file}" alt="${this.escapeHtml(name)}" loading="lazy"${imgStyle}>
        <span class="image-resize-edge edge-bottom" data-image-key="${this.escapeHtml(key)}" data-resize-edge="bottom" title="Resize height"></span>
        ${footnotesHtml}
      </figure>
    `;
    }

    renderInlineImage(item, context) {
      const { file, key, layout } = item;
      const {
        topic,
        placementByKey,
        imageBorderByKey,
        imageFlowMultiplier,
      } = context;
      const name = file.split("/").pop() || file;
      const placement = placementByKey.get(key);
      const imgWidthPx = this.normalizeImageWidthPx(placement?.imgWidthPx);
      const resizeMode = this.normalizeImageResizeMode(placement?.resizeMode);
      const lockedAspectRatio = this.normalizeImageAspectRatio(placement?.lockedAspectRatio);
      const hasLockedRatio = false;
      const freeHeightPx = this.normalizeImagePixelSize(placement?.freeHeightPx);
      const widthPx = this.normalizeImageWidthPx(placement?.imgWidthPx);
      const imgStyle = resizeMode === "free"
        ? (freeHeightPx
          ? ` style="width:${widthPx}px; height:${freeHeightPx}px;"`
          : ` style="width:${widthPx}px; height:auto;"`)
        : ` style="width:${widthPx}px; height:auto;"`;
      const spacing = this.computeInlineFlowSpacing(imgWidthPx, imageFlowMultiplier);
      const inlineLayout = layout === "float-left" || layout === "float-right" ? layout : "float-right";
      const manualFootnote = String(context?.imageMeta?.[key]?.footnote || "").replace(/\r\n/g, "\n");
      const hasFootnote = manualFootnote.length > 0;
      const rawFootnotesHtml = hasFootnote
        ? this.renderTableFootnotes(manualFootnote, [], 64, { allowPrimaryAutoMerge: false, preserveEmptyAutoRows: true })
        : "";
      const footnotesHtml = rawFootnotesHtml
        ? `<div class="image-footnote-wrap">${rawFootnotesHtml}</div>`
        : "";
      const border = imageBorderByKey?.get(key) || { enabled: false, widthPx: 0, color: "#4d5b68", radiusPx: 6 };
      const inlineBorderGapCompFactor = 1.6;
      const inlineBorderCompPx = border.enabled
        ? Math.round(Math.max(0, Number(border.widthPx || 0)) * inlineBorderGapCompFactor)
        : 0;
      const reducedBottomGapPx = Math.max(
        0,
        spacing.bottomGapPx - inlineBorderCompPx,
      );
      const borderStyle = ` --image-border-width:${border.enabled ? border.widthPx : 0}px; --image-border-color:${this.escapeHtml(border.color || "#4d5b68")}; --image-border-radius:${border.radiusPx ?? 6}px;`;
      return `
      <span class="article-image-inline-wrap layout-${inlineLayout} resize-mode-${resizeMode}${hasLockedRatio ? " has-locked-ratio" : ""}" data-image-key="${this.escapeHtml(key)}" style="--image-size-pct:${imgWidthPx}px; --image-inline-gap-px:${spacing.textGapPx}px; --image-inline-top-gap-px:${spacing.topGapPx}px; --image-inline-bottom-gap-px:${reducedBottomGapPx}px;${hasLockedRatio ? ` --image-locked-ratio:${lockedAspectRatio};` : ""}${borderStyle}">
        <span class="placed-item-drag-handle image-drag-handle inline-drag-handle" data-image-key="${this.escapeHtml(key)}" draggable="true" title="Drag image">DRAG</span>
        <button type="button" class="thumb-remove-btn card-remove-btn image-placed-remove-btn" data-image-key="${this.escapeHtml(key)}" title="Remove image from article">x</button>
        <img class="article-image-inline" id="${this.escapeHtml(this.imageDomId(topic, file))}" src="${file}" alt="${this.escapeHtml(name)}" loading="lazy"${imgStyle}>
        <span class="image-resize-edge edge-bottom" data-image-key="${this.escapeHtml(key)}" data-resize-edge="bottom" title="Resize height"></span>
        ${footnotesHtml}
      </span>
    `;
    }
  }

  class TableFeatureRenderer {
    constructor(deps) {
      this.escapeHtml = deps.escapeHtml;
      this.normalizeTableLayout = deps.normalizeTableLayout;
      this.normalizeTableWidthPx = deps.normalizeTableWidthPx;
      this.normalizeTableSizeStage = deps.normalizeTableSizeStage;
      this.normalizeImageGroupId = deps.normalizeImageGroupId;
      this.getSelectedTableKey = deps.getSelectedTableKey;
      this.tableTitlePlaceholderFromFileName = deps.tableTitlePlaceholderFromFileName;
      this.csvToTable = deps.csvToTable;
      this.renderTableFootnotes = deps.renderTableFootnotes;
      this.tableViewerUrl = deps.tableViewerUrl;
    }

    tableAutoL4ClassName(tableKey) {
      const raw = String(tableKey || "").toLowerCase();
      const slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "table";
      return `table-auto-l4-${slug}`;
    }

    renderPlacedTable(item, context) {
      const { key, layout, position } = item;
      const {
        topic,
        tablePartByKey,
        tablePlacements,
        tableMeta,
        templateTableDesign,
        templateTableHeaderOptimizer,
        templateTableCompaction,
      } = context;
      const part = tablePartByKey.get(key);
      if (!part) return "";
      const placement = tablePlacements.find((p) => p.file === key);
      const isInline = position === "inside";
      const normalizedLayout = this.normalizeTableLayout(layout);
      const widthPx = this.normalizeTableWidthPx(placement?.widthPx);
      const isInRow = Boolean(this.normalizeImageGroupId?.(placement?.groupId));
      const isManualWidth = !isInRow && Boolean(placement?.manualWidth);
      const supportsSideFootnote = !isInline && (normalizedLayout === "float-left" || normalizedLayout === "float-right");
      const isSideFootnote = supportsSideFootnote && Boolean(placement?.footnoteSide);
      const isSelected = this.getSelectedTableKey(topic) === key;
      const hasMetaEntry = Object.prototype.hasOwnProperty.call(tableMeta, key)
        && tableMeta[key]
        && typeof tableMeta[key] === "object";
      const meta = hasMetaEntry ? tableMeta[key] : { title: "", footnote: "" };
      const hasExplicitTitle = hasMetaEntry && Object.prototype.hasOwnProperty.call(meta, "title");
      const title = hasExplicitTitle
        ? String(meta.title || "").trim()
        : "";
      const headingHtml = (!isInline && title)
        ? `<h3>${this.escapeHtml(title)}</h3>`
        : "";
      const tableRendered = this.csvToTable(part.csv, templateTableDesign.className, templateTableHeaderOptimizer);
      const sizeStage = this.normalizeTableSizeStage(placement?.sizeStage);
      const compactionStyleId = templateTableCompaction?.l1StyleId || "l1-balanced";
      const l1HeaderFontPx = Number(templateTableCompaction?.l1HeaderFontPx || 13);
      const l1BodyFontPx = Number(templateTableCompaction?.l1BodyFontPx || 12);
      const l1PadX = Number(templateTableCompaction?.l1PadX || 6);
      const l1PadY = Number(templateTableCompaction?.l1PadY || 4);
      const l2Scale = Number(templateTableCompaction?.l2Scale || 0.84);
      const stageScale = sizeStage === 3 ? Math.max(0.5, Number((l2Scale * 0.82).toFixed(2))) : (sizeStage === 2 ? l2Scale : 1);
      const compactHeaderFontPx = sizeStage >= 2 ? Math.max(9, Math.round(l1HeaderFontPx * stageScale)) : l1HeaderFontPx;
      const compactBodyFontPx = sizeStage >= 2 ? Math.max(8, Math.round(l1BodyFontPx * stageScale)) : l1BodyFontPx;
      const compactPadX = sizeStage >= 2 ? Math.max(2, Math.round(l1PadX * stageScale)) : l1PadX;
      const compactPadY = sizeStage >= 2 ? Math.max(2, Math.round(l1PadY * stageScale)) : l1PadY;
      const rawFootnotesHtml = this.renderTableFootnotes(meta.footnote || "", tableRendered.autoFootnotes || [], tableRendered.tableWidthCh);
      const footnotesHtml = rawFootnotesHtml
        ? `
        <div class="table-footnote-wrap${isSideFootnote ? " is-side" : ""}">
          ${supportsSideFootnote ? `<button type="button" class="table-footnote-toggle" data-table-key="${this.escapeHtml(key)}" title="${isSideFootnote ? "Move footnote below table" : "Move footnote to side"}">${isSideFootnote ? "Footnote: Below" : "Footnote: Side"}</button>` : ""}
          ${rawFootnotesHtml}
        </div>
      `
        : "";
      const widthCh = Math.max(24, Math.round(Number(tableRendered.tableWidthCh) || 64));
      const styleVars = [
        `--table-opt-width-ch:${widthCh}`,
        `--table-footnote-width-ch:${widthCh + 4}`,
        `--table-compact-header-size-px:${compactHeaderFontPx}`,
        `--table-compact-body-size-px:${compactBodyFontPx}`,
        `--table-compact-pad-x-px:${compactPadX}`,
        `--table-compact-pad-y-px:${compactPadY}`,
      ];
      if (sizeStage === 4) styleVars.push("--table-launch-size-px:210");
      if (isManualWidth) styleVars.push(`--table-width-px:${widthPx}px`);
      const classes = [
        "article-table-block",
        "article-table-placed",
        isInline ? "article-table-inline-wrap" : "",
        `layout-${normalizedLayout}`,
        isManualWidth ? "has-manual-width" : "",
        isSideFootnote ? "footnote-side" : "",
        isSelected ? "is-selected" : "",
        sizeStage === 1 || sizeStage === 2 || sizeStage === 3 ? "table-size-compact" : "",
        sizeStage === 2 ? "table-size-compact-l2" : "",
        sizeStage === 3 ? "table-size-compact-l3" : "",
        sizeStage === 2 ? "table-size-footnote-sm" : "",
        sizeStage === 3 ? "table-size-footnote-xs" : "",
        sizeStage === 4 ? "table-size-launch" : "",
        isInRow ? "table-in-row" : "",
        sizeStage === 1 || sizeStage === 2 || sizeStage === 3 ? `table-size-style-${compactionStyleId}` : "",
      ].filter(Boolean).join(" ");
      const resizeEdge = normalizedLayout === "float-right" ? "left" : "right";
      const viewerHref = this.tableViewerUrl(topic, part.name);
      const compactViewerCard = `
        <a class="table-data-launch-card" href="${this.escapeHtml(viewerHref)}" target="_blank" rel="noopener noreferrer" title="Open table data in new tab">
          <span class="table-data-launch-icon" aria-hidden="true">▦</span>
          <span class="table-data-launch-text">Table data: Click to see in new tab.</span>
        </a>
      `;
      const autoL4ClassName = this.tableAutoL4ClassName(key);
      const autoL4BreakpointPx = Math.max(1, Math.floor(widthPx / 0.9));
      const autoL4StyleHtml = sizeStage === 4
        ? ""
        : `
        <style class="table-auto-l4-style">
          @media (max-width: ${autoL4BreakpointPx}px) {
            .article-table-placed.${autoL4ClassName} .table-content-full { display: none; }
            .article-table-placed.${autoL4ClassName} .table-content-launch { display: block; }
            .article-table-placed.${autoL4ClassName}:not(.article-table-inline-wrap),
            .article-table-placed.${autoL4ClassName}.layout-block-center:not(.article-table-inline-wrap),
            .article-table-placed.${autoL4ClassName}.layout-float-left:not(.article-table-inline-wrap),
            .article-table-placed.${autoL4ClassName}.layout-float-right:not(.article-table-inline-wrap),
            .article-table-placed.${autoL4ClassName}.has-manual-width:not(.article-table-inline-wrap),
            .article-table-placed.${autoL4ClassName}.layout-float-left.has-manual-width:not(.article-table-inline-wrap),
            .article-table-placed.${autoL4ClassName}.layout-float-right.has-manual-width:not(.article-table-inline-wrap),
            .article-table-placed.${autoL4ClassName}.article-table-inline-wrap,
            .article-table-placed.${autoL4ClassName}.article-table-inline-wrap.has-manual-width {
              width: min(calc(var(--table-launch-size-px, 210) * 1px), 100%);
            }
            .article-table-placed.${autoL4ClassName} .table-open-overlay-link { display: none; }
          }
        </style>
      `;
      const overlayLinkHtml = `<a class="table-open-overlay-link" href="${this.escapeHtml(viewerHref)}" target="_blank" rel="noopener noreferrer" title="Open table data in new tab" aria-label="Open table data in new tab">▦</a>`;
      const fullContentHtml = `${tableRendered.html}${footnotesHtml}${overlayLinkHtml}`;
      return `
      ${autoL4StyleHtml}
      <section class="${classes} ${autoL4ClassName}" data-table-key="${this.escapeHtml(key)}" draggable="true" style="${styleVars.join(";")}">
        <span class="placed-item-drag-handle table-drag-handle" data-table-key="${this.escapeHtml(key)}" draggable="true" title="Drag table">DRAG</span>
        <button type="button" class="thumb-remove-btn card-remove-btn table-placed-remove-btn" data-table-key="${this.escapeHtml(key)}" title="Remove table from article">x</button>
        ${isSelected && sizeStage !== 4 && !isInRow ? `<span class="table-resize-edge edge-${resizeEdge}" data-table-key="${this.escapeHtml(key)}" data-resize-edge="${resizeEdge}" title="Resize table width"></span>` : ""}
        ${headingHtml}
        <div class="table-content-full">${fullContentHtml}</div>
        <div class="table-content-launch">${compactViewerCard}</div>
      </section>
    `;
    }
  }

  class VideoFeatureRenderer {
    constructor(deps) {
      this.escapeHtml = deps.escapeHtml;
      this.videoDomId = deps.videoDomId;
      this.normalizeVideoLayout = deps.normalizeVideoLayout;
      this.normalizeVideoWidthPx = typeof deps.normalizeVideoWidthPx === "function"
        ? deps.normalizeVideoWidthPx
        : ((value) => {
          const n = Number(value);
          if (!Number.isFinite(n)) return 360;
          return Math.max(120, Math.round(n));
        });
      this.normalizeVideoWidthPct = deps.normalizeVideoWidthPct;
      this.renderTableFootnotes = deps.renderTableFootnotes;
    }

    renderPlacedVideo(item, context) {
      const topic = context?.topic || "";
      const key = String(item?.key || "").trim();
      const tagHtml = String(item?.tagHtml || "").trim();
      const position = String(item?.position || "after");
      const normalizedLayout = this.normalizeVideoLayout(item?.layout);
      const isExternal = key.startsWith("/__external_videos__/");
      const widthPx = this.normalizeVideoWidthPx(item?.widthPx);
      const borderEnabled = Boolean(item?.borderEnabled);
      const borderColor = String(item?.borderColor || "#2f5f8a").trim() || "#2f5f8a";
      const borderWidthPx = Math.max(0, Number(item?.borderWidthPx) || 0);
      const borderRadiusPx = Math.max(0, Number(item?.borderRadiusPx) || 8);
      const flowMarginTopPx = Math.max(0, Number(item?.flowMarginTopPx) || 30);
      const flowMarginBottomPx = Math.max(0, Number(item?.flowMarginBottomPx) || 22);
      const flowInlineTextGapPx = Math.max(0, Number(item?.flowInlineTextGapPx) || 16);
      const isInline = position === "inside";
      const manualFootnote = String(item?.footnoteManual || item?.footnote || "").trim();
      const attrTicks = item?.attrTicks && typeof item.attrTicks === "object" ? item.attrTicks : {};
      const tickLinesByKey = item?.tickLines && typeof item.tickLines === "object" ? item.tickLines : {};
      const tickLines = ["filename", "duration", "fileSize", "resolutionEncoding"]
        .filter((tickKey) => Boolean(attrTicks[tickKey]))
        .map((tickKey) => String(tickLinesByKey[tickKey] || "").trim())
        .filter(Boolean);
      const autoFootnotes = manualFootnote && tickLines.length ? ["", ...tickLines] : tickLines;
      const hasFootnote = Boolean(manualFootnote) || tickLines.length > 0;
      const supportsSideFootnote = !isInline && (normalizedLayout === "float-left" || normalizedLayout === "float-right");
      const isSideFootnote = supportsSideFootnote && Boolean(item?.footnoteSide);
      if (!key || !tagHtml) return "";
      const rawFootnotesHtml = hasFootnote
        ? this.renderTableFootnotes(manualFootnote, autoFootnotes, 64, { allowPrimaryAutoMerge: false, preserveEmptyAutoRows: true })
        : "";
      const footnotesHtml = hasFootnote
        ? `
        <div class="video-footnote-wrap${isSideFootnote ? " is-side" : ""}" data-video-footnote-manual="${this.escapeHtml(encodeURIComponent(manualFootnote))}" data-video-footnote-lines="${this.escapeHtml(encodeURIComponent(tickLines.join("\n")))}">
          ${supportsSideFootnote ? `<button type="button" class="video-footnote-toggle" data-video-key="${this.escapeHtml(key)}" title="${isSideFootnote ? "Move footnote below video" : "Move footnote to side"}">${isSideFootnote ? "Footnote: Below" : "Footnote: Side"}</button>` : ""}
          ${rawFootnotesHtml}
        </div>
      `
        : "";
      const styleVars = [
        `--video-border-width:${borderEnabled ? borderWidthPx : 0}px`,
        `--video-border-color:${this.escapeHtml(borderColor)}`,
        `--video-border-radius:${borderRadiusPx}px`,
        `--video-flow-top-px:${flowMarginTopPx}`,
        `--video-flow-bottom-px:${flowMarginBottomPx}`,
        `--video-inline-text-gap-px:${flowInlineTextGapPx}`,
      ];
      styleVars.push(`--video-width-px:${widthPx}px`);
      const classes = [
        "article-video-block",
        isExternal ? "is-external-video" : "is-local-video",
        isInline ? "article-video-inline-wrap" : "",
        `layout-${normalizedLayout}`,
        "has-manual-width",
        isSideFootnote ? "footnote-side" : "",
      ].filter(Boolean).join(" ");
      return `
      <section class="${classes}" data-video-key="${this.escapeHtml(key)}" draggable="true" style="${styleVars.join(";")}">
        <span class="placed-item-drag-handle video-drag-handle" data-video-key="${this.escapeHtml(key)}" draggable="true" title="Drag video">DRAG</span>
        <button type="button" class="thumb-remove-btn card-remove-btn video-placed-remove-btn" data-video-key="${this.escapeHtml(key)}" title="Remove video from article">x</button>
        <div class="article-video-shell" id="${this.escapeHtml(this.videoDomId(topic, key))}">
          ${tagHtml}
        </div>
        ${footnotesHtml}
      </section>
    `;
    }
  }

  class AudioFeatureRenderer {
    constructor(deps) {
      this.escapeHtml = deps.escapeHtml;
    }

    renderPlacedAudio(item) {
      const key = String(item?.key || "").trim();
      if (!key) return "";
      const title = String(item?.title || "RW Smart Audio Playlist").trim();
      const footer = String(item?.footer || "").trim();
      const layoutRaw = String(item?.layout || "block-center");
      const layout = (layoutRaw === "float-left" || layoutRaw === "float-right" || layoutRaw === "block-center")
        ? layoutRaw
        : "block-center";
      const position = String(item?.position || "after");
      const isInline = position === "inside";
      const borderEnabled = Boolean(item?.borderEnabled);
      const borderColor = String(item?.borderColor || "#2f5f8a");
      const borderWidthPx = Number.isFinite(Number(item?.borderWidthPx)) ? Number(item.borderWidthPx) : 2;
      const borderRadiusPx = Number.isFinite(Number(item?.borderRadiusPx)) ? Number(item.borderRadiusPx) : 8;
      const flowMarginTopPx = Number.isFinite(Number(item?.flowMarginTopPx)) ? Number(item.flowMarginTopPx) : 30;
      const flowMarginBottomPx = Number.isFinite(Number(item?.flowMarginBottomPx)) ? Number(item.flowMarginBottomPx) : 22;
      const flowInlineTextGapPx = Number.isFinite(Number(item?.flowInlineTextGapPx)) ? Number(item.flowInlineTextGapPx) : 16;
      const manualWidth = Boolean(item?.manualWidth);
      const widthPctRaw = Number(item?.widthPct);
      const widthPct = Number.isFinite(widthPctRaw)
        ? Math.max(30, Math.min(100, Math.round(widthPctRaw)))
        : 100;
      const tracks = Array.isArray(item?.tracks) ? item.tracks : [];
      const missingTrackCount = tracks.filter((track) => {
        if (!track || typeof track !== "object") return false;
        if (Boolean(track.missing)) return true;
        const sizeValue = Number(track.size);
        return Number.isFinite(sizeValue) && sizeValue <= 0;
      }).length;
      const missingNoteHtml = missingTrackCount > 0
        ? `<div class="rw-audio-missing-note">Missing track files: ${missingTrackCount}. Add files to source folder and rerun LMF.</div>`
        : "";
      const trackListHtml = tracks
        .map((track, index) => {
          const trackTitle = String(track?.title || `Track ${index + 1}`).trim();
          const trackSrc = String(track?.src || "").trim();
          if (!trackSrc) return "";
          return `
            <li class="rw-track" data-src="${this.escapeHtml(trackSrc)}" data-title="${this.escapeHtml(trackTitle)}">
              <div class="rw-row">
                <span class="rw-title">${this.escapeHtml(trackTitle)}</span>
                <span class="rw-duration"><span class="rw-time-icon" aria-hidden="true">⏱</span><span class="rw-duration-value">--:-- / --:--</span></span>
                <input class="rw-track-volume rw-volume-control" type="range" min="0" max="1" step="0.01" value="0.35" aria-label="Track volume">
              </div>
              <div class="rw-progress"><div class="rw-progress-bar"></div></div>
            </li>
          `;
        })
        .join("\n");
      const playlistJson = this.escapeHtml(JSON.stringify(tracks.map((track) => ({
        title: track?.title,
        src: track?.src,
        size: Number.isFinite(Number(track?.size)) ? Number(track.size) : null,
      })))).replaceAll('"', "&quot;");
      const firstTrackSrc = String(tracks[0]?.src || "").trim();
      const styleVars = [
        `--audio-width-pct:${widthPct}`,
        `--audio-border-width:${borderEnabled ? borderWidthPx : 0}px`,
        `--audio-border-color:${borderColor}`,
        `--audio-border-radius:${borderRadiusPx}px`,
        `--audio-flow-top-px:${flowMarginTopPx}`,
        `--audio-flow-bottom-px:${flowMarginBottomPx}`,
        `--audio-inline-text-gap-px:${flowInlineTextGapPx}`,
      ];
      const classes = [
        "article-audio-block",
        isInline ? "article-audio-inline-wrap" : "",
        `layout-${layout}`,
        manualWidth ? "has-manual-width" : "",
      ].filter(Boolean).join(" ");
      const audioThemeIdRaw = String(item?.audioThemeId || "studio-dark").trim();
      const audioThemeId = /^[a-z0-9-]+$/i.test(audioThemeIdRaw) ? audioThemeIdRaw : "studio-dark";
      return `
      <section class="${classes}" data-audio-key="${this.escapeHtml(key)}" style="${styleVars.join(";")}">
        <span class="placed-item-drag-handle audio-drag-handle" data-audio-key="${this.escapeHtml(key)}" draggable="true" title="Drag audio">DRAG</span>
        <button type="button" class="thumb-remove-btn card-remove-btn audio-placed-remove-btn" data-audio-key="${this.escapeHtml(key)}" title="Remove audio from article">x</button>
        <div class="rw-audio-player audio-theme-${this.escapeHtml(audioThemeId)}" data-playlist-id="${this.escapeHtml(key)}" data-tracks="${playlistJson}">
          <div class="rw-audio-header">
            <div class="rw-audio-art">
              <button type="button" class="rw-audio-focus-titlebar" data-audio-key="${this.escapeHtml(key)}" title="Focus audio card">
                <span class="rw-audio-title">${this.escapeHtml(title)}</span>
              </button>
            </div>
            <div class="rw-active-track-panel" aria-live="polite">
              <div class="rw-active-track-marquee">
                <div class="rw-active-track-marquee-track">
                  <span class="rw-active-track-text">No track selected</span>
                  <span class="rw-active-track-text" aria-hidden="true">No track selected</span>
                </div>
              </div>
            </div>
          </div>
          <audio class="rw-audio" controls preload="none"${firstTrackSrc ? ` src="${this.escapeHtml(firstTrackSrc)}"` : ""}></audio>
          <div class="rw-track-stats">
            <div class="rw-track-stats-main">
              <span class="rw-track-stats-item rw-track-stats-total">Total: 0 (0m)</span>
            </div>
            <input class="rw-global-volume rw-global-volume-inline rw-track-stats-volume rw-volume-control" type="range" min="0" max="1" step="0.01" aria-label="Global volume">
          </div>
          <ul class="rw-tracklist">
            ${trackListHtml || '<li class="rw-track empty">No tracks available</li>'}
          </ul>
          ${missingNoteHtml}
          <div class="rw-small">✔ Click a track to play — progress and position are remembered.</div>
        </div>
      </section>
    `;
    }
  }

  const AUDIO_PLAYLIST_STORAGE_PREFIX = "rw_audio_playlist";

  class AudioPlaylistWidget {
    constructor(container) {
      this.container = container;
      this.audioEl = container.querySelector(".rw-audio");
      this.volumeSlider = container.querySelector(".rw-global-volume");
      this.activeTrackPanel = container.querySelector(".rw-active-track-panel");
      this.activeTrackTexts = Array.from(container.querySelectorAll(".rw-active-track-text"));
      this.statsTotalEl = container.querySelector(".rw-track-stats-total");
      this.trackEls = Array.from(container.querySelectorAll(".rw-track[data-src]"));
      this.playlistId = String(container.dataset.playlistId || "default");
      this.positions = {};
      this.playedSet = new Set();
      this.trackVolumes = {};
      this.listenTotals = {};
      this.trackDurations = new Map();
      this.probedTracks = new Set();
      this.activeTrackEl = null;
      this.globalVolume = 0.35;
      this.lastTimeKey = "";
      this.lastTimePos = 0;
      this.suppressAudioVolumeSync = false;
      this.progressRafId = 0;
      this.storagePrefix = `${AUDIO_PLAYLIST_STORAGE_PREFIX}:${this.playlistId}`;
      this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
      this.handleSeekSync = this.handleSeekSync.bind(this);
      this.handlePlaybackStateChange = this.handlePlaybackStateChange.bind(this);
      this.runLiveProgressLoop = this.runLiveProgressLoop.bind(this);
      this.handleVolumeInput = this.handleVolumeInput.bind(this);
      this.handleAudioVolumeChange = this.handleAudioVolumeChange.bind(this);
      this.scheduleDurationProbes = this.scheduleDurationProbes.bind(this);
      this.init();
    }

    init() {
      if (!this.audioEl) return;
      this.loadStorage();
      this.setupVolumeControl();
      this.trackEls.forEach((trackEl) => {
        trackEl.addEventListener("click", (event) => this.handleTrackClick(trackEl, event));
        const volSlider = trackEl.querySelector(".rw-track-volume");
        if (volSlider instanceof HTMLInputElement) {
          volSlider.addEventListener("pointerdown", (event) => event.stopPropagation());
          volSlider.addEventListener("click", (event) => event.stopPropagation());
          volSlider.addEventListener("input", () => this.handleTrackVolumeInput(trackEl, volSlider));
        }
        this.updateTrackPlayedClass(trackEl);
        this.updateTrackVolumeUi(trackEl);
      });
      this.scheduleDurationProbes();
      this.audioEl.addEventListener("timeupdate", this.handleTimeUpdate);
      this.audioEl.addEventListener("seeking", this.handleSeekSync);
      this.audioEl.addEventListener("seeked", this.handleSeekSync);
      this.audioEl.addEventListener("play", this.handlePlaybackStateChange);
      this.audioEl.addEventListener("pause", this.handlePlaybackStateChange);
      this.audioEl.addEventListener("ended", this.handlePlaybackStateChange);
      this.audioEl.addEventListener("volumechange", this.handleAudioVolumeChange);
      this.updateProgressBars();
      this.updateStats();
      this.setActiveTrackLabel("No track selected");
    }

    scheduleDurationProbes() {
      if (!this.trackEls.length) return;
      const initialCount = Math.min(3, this.trackEls.length);
      this.trackEls.slice(0, initialCount).forEach((trackEl) => this.probeTrackDuration(trackEl));
      if (this.trackEls.length <= initialCount) return;
      const delayed = this.trackEls.slice(initialCount);
      delayed.forEach((trackEl, index) => {
        window.setTimeout(() => this.probeTrackDuration(trackEl), 120 * (index + 1));
      });
    }

    loadStorage() {
      this.playedSet = new Set();
      this.positions = {};
      this.trackVolumes = {};
      this.listenTotals = {};
    }

    setupVolumeControl() {
      const DEFAULT_VOLUME = 0.35;
      this.globalVolume = Math.max(0, Math.min(1, DEFAULT_VOLUME));
      this.setAudioElementVolume(this.globalVolume);
      this.updateVolumeLabel(this.globalVolume);
      if (this.volumeSlider) {
        this.volumeSlider.value = String(this.globalVolume);
        this.volumeSlider.addEventListener("input", this.handleVolumeInput);
      }
    }

    handleVolumeInput() {
      if (!this.volumeSlider || !this.audioEl) return;
      const value = Number(this.volumeSlider.value);
      if (!Number.isFinite(value)) return;
      this.globalVolume = Math.max(0, Math.min(1, value));
      this.updateVolumeLabel(this.globalVolume);
      this.saveVolume(this.globalVolume);
      if (this.activeTrackEl) {
        const activeSrc = this.trackSrcKey(this.activeTrackEl.dataset.src);
        if (activeSrc && !Number.isFinite(Number(this.trackVolumes[activeSrc]))) {
          this.setAudioElementVolume(this.globalVolume);
        }
      } else {
        this.setAudioElementVolume(this.globalVolume);
      }
      this.trackEls.forEach((trackEl) => this.updateTrackVolumeUi(trackEl));
    }

    updateVolumeLabel(value) {
      void value;
    }

    handleTrackClick(trackEl, event) {
      if (!trackEl || !this.audioEl) return;
      const target = event?.target;
      if (
        target instanceof HTMLElement
        && target.closest(".rw-track-volume")
      ) {
        return;
      }
      const srcValue = String(trackEl.dataset.src || "").trim();
      const srcKey = this.trackSrcKey(srcValue);
      if (!srcKey) return;
      const activeSrc = this.activeAudioKey();
      const isSameTrack = activeSrc === srcKey;
      if (this.activeTrackEl === trackEl && activeSrc === srcKey && !this.audioEl.paused) {
        this.audioEl.pause();
        return;
      }
      this.probeTrackDuration(trackEl);
      this.selectTrack(trackEl);
      this.applyTrackVolumeForSrc(srcKey);
      if (!isSameTrack) {
        const savedTime = Number(this.positions[srcKey]);
        this.loadTrackSource(srcValue, savedTime);
        return;
      }
      const savedTime = Number(this.audioEl.currentTime);
      if (Number.isFinite(savedTime) && savedTime >= 0) {
        try {
          this.audioEl.currentTime = Math.max(0, Math.min(savedTime, this.audioEl.duration || savedTime));
        } catch {
          // ignore invalid time
        }
      }
      this.audioEl.play().catch(() => {});
    }

    loadTrackSource(src, resumeTime) {
      if (!this.audioEl) return;
      const playableSrc = this.resolveTrackUrl(src);
      if (!playableSrc) return;
      const resume = () => {
        this.audioEl.removeEventListener("loadedmetadata", resume);
        this.audioEl.removeEventListener("canplay", resume);
        if (Number.isFinite(resumeTime) && resumeTime > 0) {
          try {
            this.audioEl.currentTime = Math.max(0, Math.min(resumeTime, this.audioEl.duration || resumeTime));
          } catch {
            // ignore invalid time
          }
        }
        this.handleSeekSync();
        this.audioEl.play().catch(() => {});
      };
      this.audioEl.addEventListener("loadedmetadata", resume);
      this.audioEl.addEventListener("canplay", resume);
      this.audioEl.src = playableSrc;
      this.audioEl.load();
      if (this.audioEl.readyState >= 1) resume();
    }

    selectTrack(trackEl) {
      if (this.activeTrackEl) {
        this.activeTrackEl.classList.remove("active");
      }
      this.activeTrackEl = trackEl;
      trackEl.classList.add("active");
      this.setActiveTrackLabel(String(trackEl.dataset.title || "Untitled"));
      this.markTrackPlayed(trackEl);
      this.updateProgressBars();
    }

    markTrackPlayed(trackEl) {
      const key = this.trackSrcKey(trackEl.dataset.src);
      if (!key) return;
      if (!this.playedSet.has(key)) {
        this.playedSet.add(key);
        this.savePlayed();
      }
      trackEl.classList.add("played");
    }

    probeTrackDuration(trackEl) {
      const srcValue = String(trackEl.dataset.src || "").trim();
      const src = this.trackSrcKey(srcValue);
      const playableSrc = this.resolveTrackUrl(srcValue);
      if (!src || !playableSrc) return;
      if (this.probedTracks.has(src) || this.trackDurations.has(src)) return;
      this.probedTracks.add(src);
      const probe = new Audio();
      probe.preload = "metadata";
      const updateDuration = () => {
        const duration = probe.duration;
        if (Number.isFinite(duration) && duration > 0) {
          this.trackDurations.set(src, duration);
          this.updateProgressBars();
        }
      };
      probe.addEventListener("loadedmetadata", updateDuration);
      probe.addEventListener("durationchange", updateDuration);
      probe.src = playableSrc;
    }

    handleTimeUpdate() {
      if (!this.audioEl) return;
      const src = this.activeAudioKey();
      if (!src) return;
      const current = Number(this.audioEl.currentTime);
      if (this.lastTimeKey !== src) {
        this.lastTimeKey = src;
        this.lastTimePos = current;
      } else {
        const delta = current - this.lastTimePos;
        if (Number.isFinite(delta) && delta > 0 && delta < 5) {
          const prev = Number(this.listenTotals[src]);
          this.listenTotals[src] = (Number.isFinite(prev) ? prev : 0) + delta;
          this.saveListenTotals();
        }
        this.lastTimePos = current;
      }
      this.positions[src] = this.audioEl.currentTime;
      this.savePositions();
      this.updateProgressBars();
      this.updateStats();
    }

    handleSeekSync() {
      if (!this.audioEl) return;
      const src = this.activeAudioKey();
      if (!src) return;
      const current = Number(this.audioEl.currentTime);
      this.positions[src] = current;
      this.lastTimeKey = src;
      this.lastTimePos = current;
      this.savePositions();
      this.updateProgressBars();
      this.updateStats();
      this.handlePlaybackStateChange();
    }

    handlePlaybackStateChange() {
      if (!this.audioEl) return;
      if (this.audioEl.paused || this.audioEl.ended) {
        if (this.progressRafId) {
          window.cancelAnimationFrame(this.progressRafId);
          this.progressRafId = 0;
        }
        this.updateProgressBars();
        return;
      }
      if (this.progressRafId) return;
      this.progressRafId = window.requestAnimationFrame(this.runLiveProgressLoop);
    }

    runLiveProgressLoop() {
      this.progressRafId = 0;
      if (!this.audioEl || this.audioEl.paused || this.audioEl.ended) {
        this.updateProgressBars();
        return;
      }
      this.updateProgressBars();
      this.progressRafId = window.requestAnimationFrame(this.runLiveProgressLoop);
    }

    updateProgressBars() {
      const activeAudioSrc = this.activeAudioKey();
      const activeCurrentTime = this.audioEl ? Number(this.audioEl.currentTime) : 0;
      const activeDuration = this.audioEl ? Number(this.audioEl.duration) : 0;
      if (activeAudioSrc && Number.isFinite(activeCurrentTime) && activeCurrentTime >= 0) {
        this.positions[activeAudioSrc] = activeCurrentTime;
      }
      this.trackEls.forEach((trackEl) => {
        const src = this.trackSrcKey(trackEl.dataset.src);
        if (!src) return;
        const bar = trackEl.querySelector(".rw-progress-bar");
        if (!(bar instanceof HTMLElement)) return;
        const durationValueEl = trackEl.querySelector(".rw-duration-value");
        const storedDuration = this.trackDurations.get(src);
        const stored = Number.isFinite(Number(this.positions[src])) ? Number(this.positions[src]) : 0;
        const isActive = activeAudioSrc === src;
        let percent = 0;
        let played = stored;
        let duration = storedDuration;
        if (isActive) {
          played = Number.isFinite(activeCurrentTime) && activeCurrentTime >= 0 ? activeCurrentTime : 0;
          duration = Number.isFinite(activeDuration) && activeDuration > 0
            ? activeDuration
            : (Number.isFinite(Number(storedDuration)) ? Number(storedDuration) : 0);
          percent = duration > 0 ? (played / duration) * 100 : 0;
        } else if (duration) {
          played = stored;
          percent = (stored / Number(duration)) * 100;
        }
        if (durationValueEl instanceof HTMLElement) {
          const totalLabel = Number.isFinite(Number(duration)) && Number(duration) > 0 ? this.formatTime(Number(duration)) : "--:--";
          durationValueEl.textContent = totalLabel;
        }
        bar.style.width = `${Math.min(100, Math.max(0, percent || 0))}%`;
      });
      if (activeAudioSrc) this.savePositions();
      this.updateStats();
    }

    trackSrcKey(value) {
      const resolved = this.resolveTrackUrl(value);
      if (!resolved) return "";
      try {
        const parsed = new URL(resolved);
        if (parsed.protocol === "file:") {
          return decodeURIComponent(parsed.pathname || "");
        }
        return parsed.href;
      } catch {
        return resolved;
      }
    }

    resolveTrackUrl(value) {
      if (!value) return "";
      try {
        const baseUrl = document.baseURI || window.location.href;
        const resolved = new URL(value, baseUrl);
        return resolved.href;
      } catch {
        return String(value).trim();
      }
    }

    activeAudioKey() {
      if (!this.audioEl) return "";
      return this.trackSrcKey(this.audioEl.currentSrc || this.audioEl.src);
    }

    formatTime(sec) {
      if (!sec || isNaN(sec)) return "--:--";
      const minutes = Math.floor(sec / 60);
      const seconds = Math.floor(sec % 60).toString().padStart(2, "0");
      return `${minutes}:${seconds}`;
    }

    savePositions() {
      // Intentionally not persisted in browser storage.
    }

    savePlayed() {
      // Intentionally not persisted in browser storage.
    }

    saveVolume(value) {
      void value;
    }

    saveTrackVolumes() {
      // Intentionally not persisted in browser storage.
    }

    saveListenTotals() {
      // Intentionally not persisted in browser storage.
    }

    updateTrackPlayedClass(trackEl) {
      const key = this.trackSrcKey(trackEl.dataset.src);
      if (!key) return;
      trackEl.classList.toggle("played", this.playedSet.has(key));
    }

    handleTrackVolumeInput(trackEl, sliderEl) {
      const src = this.trackSrcKey(trackEl?.dataset?.src);
      if (!src) return;
      const value = Number(sliderEl.value);
      if (!Number.isFinite(value)) return;
      const normalized = Math.max(0, Math.min(1, value));
      this.trackVolumes[src] = normalized;
      this.saveTrackVolumes();
      this.updateTrackVolumeUi(trackEl);
      if (this.activeAudioKey() === src) {
        this.setAudioElementVolume(normalized);
      }
    }

    updateTrackVolumeUi(trackEl) {
      if (!(trackEl instanceof HTMLElement)) return;
      const src = this.trackSrcKey(trackEl?.dataset?.src);
      if (!src) return;
      const sliderEl = trackEl.querySelector(".rw-track-volume");
      if (!(sliderEl instanceof HTMLInputElement)) return;
      const custom = Number(this.trackVolumes[src]);
      const effective = Number.isFinite(custom) ? custom : this.globalVolume;
      sliderEl.value = String(Math.max(0, Math.min(1, effective)));
      trackEl.classList.toggle("has-custom-volume", Number.isFinite(custom));
    }

    applyTrackVolumeForSrc(src) {
      if (!this.audioEl) return;
      const custom = Number(this.trackVolumes[src]);
      const effective = Number.isFinite(custom) ? custom : this.globalVolume;
      this.setAudioElementVolume(Math.max(0, Math.min(1, effective)));
      this.updateTrackVolumeUi(this.activeTrackEl);
    }

    setAudioElementVolume(value) {
      if (!this.audioEl) return;
      this.suppressAudioVolumeSync = true;
      try {
        this.audioEl.volume = value;
      } finally {
        this.suppressAudioVolumeSync = false;
      }
    }

    handleAudioVolumeChange() {
      if (!this.audioEl || this.suppressAudioVolumeSync) return;
      const current = Math.max(0, Math.min(1, Number(this.audioEl.volume)));
      const src = this.activeAudioKey();
      if (src) {
        this.trackVolumes[src] = current;
        this.saveTrackVolumes();
        const activeSrc = this.activeTrackEl ? this.trackSrcKey(this.activeTrackEl.dataset.src) : "";
        if (activeSrc === src) {
          this.updateTrackVolumeUi(this.activeTrackEl);
        } else {
          const row = this.trackEls.find((el) => this.trackSrcKey(el.dataset.src) === src);
          this.updateTrackVolumeUi(row);
        }
        return;
      }
      this.globalVolume = current;
      this.saveVolume(current);
      if (this.volumeSlider instanceof HTMLInputElement) this.volumeSlider.value = String(current);
      this.trackEls.forEach((trackEl) => this.updateTrackVolumeUi(trackEl));
    }

    setActiveTrackLabel(text) {
      const label = String(text || "No track selected").trim() || "No track selected";
      this.activeTrackTexts.forEach((el) => {
        el.textContent = label;
      });
      if (this.activeTrackPanel instanceof HTMLElement) {
        this.activeTrackPanel.classList.toggle("is-empty", label === "No track selected");
      }
    }

    formatDurationHuman(sec) {
      const value = Number(sec);
      if (!Number.isFinite(value) || value <= 0) return "0m";
      const total = Math.round(value);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    }

    updateStats() {
      const totalCount = this.trackEls.length;
      let totalTime = 0;
      let playedTotal = 0;
      const activeAudioSrc = this.activeAudioKey();
      const activeCurrentTime = this.audioEl ? Number(this.audioEl.currentTime) : 0;
      this.trackEls.forEach((trackEl) => {
        const src = this.trackSrcKey(trackEl.dataset.src);
        if (!src) return;
        const duration = Number(this.trackDurations.get(src));
        const storedPos = Number(this.positions[src]);
        const playedRaw = (activeAudioSrc && activeAudioSrc === src && Number.isFinite(activeCurrentTime) && activeCurrentTime >= 0)
          ? activeCurrentTime
          : (Number.isFinite(storedPos) && storedPos > 0 ? storedPos : 0);
        const played = Number.isFinite(duration) && duration > 0
          ? Math.max(0, Math.min(playedRaw, duration))
          : 0;
        if (Number.isFinite(duration) && duration > 0) totalTime += duration;
        playedTotal += played;
      });
      if (this.statsTotalEl instanceof HTMLElement) {
        this.statsTotalEl.textContent = `Total: ⏱ ${this.formatDurationHuman(playedTotal)} / ${this.formatDurationHuman(totalTime)} (${totalCount} Tracks)`;
      }
    }
  }

  const audioPlaylistWidgets = new Map();
  function hydrateAudioPlaylists() {
    const containers = Array.from((document.querySelector("#pane2main") || document).querySelectorAll(".rw-audio-player"));
    const seen = new Set(containers);
    containers.forEach((container) => {
      if (!audioPlaylistWidgets.has(container)) {
        audioPlaylistWidgets.set(container, new AudioPlaylistWidget(container));
      }
    });
    for (const container of Array.from(audioPlaylistWidgets.keys())) {
      if (!document.documentElement.contains(container)) {
        audioPlaylistWidgets.delete(container);
      }
    }
  }

  globalScope.WebwriterAudioPlaylists = {
    hydrate: hydrateAudioPlaylists,
  };

  globalScope.WebwriterFeatureRenderers = {
    ImageFeatureRenderer,
    VideoFeatureRenderer,
    AudioFeatureRenderer,
    TableFeatureRenderer,
  };
}(window));

window.addEventListener('DOMContentLoaded',()=>{if(window.WebwriterAudioPlaylists&&typeof window.WebwriterAudioPlaylists.hydrate==='function'){window.WebwriterAudioPlaylists.hydrate();}});
