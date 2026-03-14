import { resolveNodeTitle } from "./nav-tree-view-helpers.js";

export function createMenuRow(options) {
  const node = options && options.node ? options.node : {};
  const row = document.createElement("div");
  const rowClassName = options && typeof options.rowClassName === "string" ? options.rowClassName : "";
  const depthClassName = options && typeof options.depthClassName === "function"
    ? options.depthClassName(node.depth)
    : "";
  row.className = rowClassName + (depthClassName ? " " + depthClassName : "");

  const paddingLeft = options && typeof options.paddingLeft === "function"
    ? options.paddingLeft(node.depth)
    : 0;
  row.style.paddingLeft = String(paddingLeft) + "px";

  const onToggle = options && typeof options.onToggle === "function" ? options.onToggle : () => {};
  const onOpen = options && typeof options.onOpen === "function" ? options.onOpen : () => {};
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
  const getTitle = options && typeof options.resolveTitle === "function" ? options.resolveTitle : resolveNodeTitle;

  if (node.hasChildren) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = options && typeof options.toggleClassName === "string" ? options.toggleClassName : "";
    toggle.textContent = node.isExpanded ? "-" : "+";
    toggle.setAttribute("aria-label", node.isExpanded ? "Collapse section" : "Expand section");
    toggle.setAttribute("aria-expanded", node.isExpanded ? "true" : "false");
    toggle.addEventListener("click", () => onToggle(node));
    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = options && typeof options.toggleSpacerClassName === "string" ? options.toggleSpacerClassName : "";
    spacer.setAttribute("aria-hidden", "true");
    row.appendChild(spacer);
  }

  if (node.isClickable) {
    const activeClass = node.isActive ? (options && typeof options.activeClassName === "string" ? options.activeClassName : " active") : "";
    const button = createButton(
      getTitle(node),
      (options && typeof options.navButtonClassName === "string" ? options.navButtonClassName : "") + activeClass,
      () => onOpen(node)
    );
    row.appendChild(button);
  } else {
    const label = document.createElement("div");
    label.className = options && typeof options.menuLabelClassName === "string" ? options.menuLabelClassName : "";
    label.textContent = getTitle(node);
    row.appendChild(label);
  }

  return row;
}

export function createArticleRow(options) {
  const node = options && options.node ? options.node : {};
  const row = document.createElement("div");
  const rowClassName = options && typeof options.rowClassName === "string" ? options.rowClassName : "";
  const depthClassName = options && typeof options.depthClassName === "function"
    ? options.depthClassName(node.depth)
    : "";
  row.className = rowClassName + (depthClassName ? " " + depthClassName : "");

  const paddingLeft = options && typeof options.paddingLeft === "function"
    ? options.paddingLeft(node.depth)
    : 0;
  row.style.paddingLeft = String(paddingLeft) + "px";

  const spacer = document.createElement("span");
  spacer.className = options && typeof options.toggleSpacerClassName === "string" ? options.toggleSpacerClassName : "";
  spacer.setAttribute("aria-hidden", "true");
  row.appendChild(spacer);

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
  const onOpen = options && typeof options.onOpen === "function" ? options.onOpen : () => {};
  const getTitle = options && typeof options.resolveTitle === "function" ? options.resolveTitle : resolveNodeTitle;

  const isHomeRow = Boolean(options && options.isHomeRow === true);
  const homePrefix = isHomeRow
    ? (typeof (options && options.homePrefix) === "string" ? options.homePrefix : "⌂ ")
    : "";
  const activeClass = node.isActive ? (options && typeof options.activeClassName === "string" ? options.activeClassName : " active") : "";
  const button = createButton(
    homePrefix + getTitle(node),
    (options && typeof options.navButtonClassName === "string" ? options.navButtonClassName : "") + activeClass,
    () => onOpen(node)
  );
  row.appendChild(button);

  return row;
}
