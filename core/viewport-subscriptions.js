function safeSubscribe(source, handler) {
  if (!source || typeof source.subscribe !== "function") {
    return () => {};
  }
  const unsubscribe = source.subscribe((event, state) => {
    try {
      handler(event, state);
    } catch (_) {
      // Keep one broken handler from breaking subscription chain.
    }
  });
  return typeof unsubscribe === "function" ? unsubscribe : () => {};
}

export function bindViewportSubscriptions(options) {
  const navigation = options && options.navigation;
  const tagPool = options && options.tagPool;
  const pagingQueue = options && options.pagingQueue;
  const configuration = options && options.configuration;

  const unbindNavigation = safeSubscribe(navigation, options && typeof options.onNavigation === "function"
    ? options.onNavigation
    : () => {});
  const unbindTagPool = safeSubscribe(tagPool, options && typeof options.onTagPool === "function"
    ? options.onTagPool
    : () => {});
  const unbindPagingQueue = safeSubscribe(pagingQueue, options && typeof options.onPagingQueue === "function"
    ? options.onPagingQueue
    : () => {});
  const unbindConfiguration = safeSubscribe(configuration, options && typeof options.onConfiguration === "function"
    ? options.onConfiguration
    : () => {});

  return () => {
    unbindNavigation();
    unbindTagPool();
    unbindPagingQueue();
    unbindConfiguration();
  };
}
