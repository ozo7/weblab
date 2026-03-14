export function resolveRailMode(navArea, fallbackMode) {
  const fallback = typeof fallbackMode === "string" && fallbackMode ? fallbackMode : "menus";
  if (navArea === "tags" || navArea === "history" || navArea === "configuration") {
    return navArea;
  }
  return fallback;
}

export function setMenuItemsActive(menuItems, mode) {
  if (!Array.isArray(menuItems)) {
    return;
  }
  menuItems.forEach((item) => {
    if (!item || typeof item.classList?.toggle !== "function") {
      return;
    }
    item.classList.toggle("active", item.getAttribute("data-mode") === mode);
  });
}
