export function ensureSelectedArticleOrFallback(options) {
  const navigation = options && options.navigation;
  if (!navigation || typeof navigation.readState !== "function") {
    return false;
  }

  const state = navigation.readState();
  const selectedId = state && typeof state.selectedArticleId === "string"
    ? state.selectedArticleId
    : null;
  const articleMap = options && options.articleMap instanceof Map ? options.articleMap : null;
  if (selectedId && (!articleMap || articleMap.has(selectedId))) {
    return false;
  }

  const fallbackArticleId = options && typeof options.fallbackArticleId === "string"
    ? options.fallbackArticleId
    : null;
  if (fallbackArticleId) {
    if (!articleMap || articleMap.has(fallbackArticleId)) {
      if (typeof navigation.openArticleById === "function") {
        navigation.openArticleById(fallbackArticleId);
        return true;
      }
    }
  }

  if (typeof navigation.openHome === "function") {
    navigation.openHome();
    return true;
  }
  return false;
}
