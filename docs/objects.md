# Objects

## Navigation
- `setLandingArticleId(articleId)`
- `getLandingArticleId()`
- `openArticle(articleId)`
- `openHome()`
- `getSelectedArticleId()`
- `subscribe(listener)`

## SiteMap
- `getTreeModel(selectedArticleId)`
- `toggleNode(nodeId)`
- `expandPathToArticle(articleId)`
- `openNode(nodeId)`
- `nodeHasChildren(nodeId)`
- `getParent(nodeId)`
- `setLandingArticleId(articleId)`
- `getLandingArticleId()`
- `setSelectedArticle(articleId)`
- `getSelectedArticle()`
- `subscribe(listener)`

## TagPool
- `getAllTags()`
- `getSelectedTags()`
- `selectTag(tag)`
- `deselectTag(tag)`
- `toggleTag(tag)`
- `clear()`
- `reset()`
- `subscribe(listener)`

## PagingQueue
- `getQueue()`
- `getAround(articleId)`
- `addPage(articleId, position)` where `position` is `"front" | "second" | "end"`
- `removePage(articleId)`
- `togglePage(articleId)`
- `rebuildFromTags()`
- `clear()`
- `reset()`
- `createSnapshot()`
- `loadSnapshot(snapshot)`
- `subscribe(listener)`

## NavigationHistory
- `recordOpen(articleId, options)`
- `canGoBack()`
- `goBack()`
- `peekBack()`
- `clear()`
- `getEntries()`
- `createSnapshot()`
- `loadSnapshot(snapshot)`
- `subscribe(listener)`

## InternalLinks
- `loadFromMigration(data)`
- `resolveAnchor(anchorLike)`
- `getOutbound(articleId)`
- `getInbound(articleId)`
- `getBrokenLinks()`
- `subscribe(listener)`
