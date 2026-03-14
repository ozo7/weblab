import { createArticleRow as buildArticleRow, createMenuRow as buildMenuRow } from "./nav-tree-row-builders.js";
import { resolveNodeTitle } from "./nav-tree-view-helpers.js";

export function createNavTreeRowBuilders(options) {
  const siteMap = options.siteMap;
  const createButton = options.createButton;
  const depthClassName = options.depthClassName;
  const paddingLeft = typeof options.paddingLeft === "function"
    ? options.paddingLeft
    : ((depth) => depth * 10);
  const onMenuToggle = options.onMenuToggle;
  const onNodeOpen = options.onNodeOpen;
  const homeArticleId = options.homeArticleId || null;
  const homePrefix = typeof options.homePrefix === "string" ? options.homePrefix : "⌂ ";
  const resolveTitle = typeof options.resolveTitle === "function"
    ? options.resolveTitle
    : resolveNodeTitle;

  function openNode(node) {
    if (!siteMap || typeof siteMap.openNode !== "function") {
      return;
    }
    const articleId = siteMap.openNode(node.nodeId);
    if (!articleId) {
      return;
    }
    if (typeof onNodeOpen === "function") {
      onNodeOpen(articleId, node);
    }
  }

  return {
    createMenuRow(node) {
      return buildMenuRow({
        node,
        rowClassName: options.menuRowClassName,
        depthClassName,
        paddingLeft,
        toggleClassName: options.menuToggleClassName,
        toggleSpacerClassName: options.toggleSpacerClassName,
        menuLabelClassName: options.menuLabelClassName,
        navButtonClassName: options.navButtonClassName,
        createButton,
        resolveTitle,
        onToggle() {
          if (typeof onMenuToggle === "function") {
            onMenuToggle(node);
          }
        },
        onOpen() {
          openNode(node);
        }
      });
    },
    createArticleRow(node) {
      const isHomeRow = Boolean(homeArticleId) && node.depth === 0 && node.articleId === homeArticleId;
      return buildArticleRow({
        node,
        rowClassName: options.articleRowClassName + (isHomeRow ? " " + options.homeRowClassName : ""),
        depthClassName,
        paddingLeft,
        toggleSpacerClassName: options.toggleSpacerClassName,
        navButtonClassName: options.navButtonClassName,
        createButton,
        resolveTitle,
        isHomeRow,
        homePrefix,
        onOpen() {
          openNode(node);
        }
      });
    }
  };
}
