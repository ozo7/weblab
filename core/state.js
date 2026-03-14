export function createRuntimeState() {
  return {
    sourceFolder: "/zz-export",
    website: null,
    tags: null,
    runtime: null,
    articleMap: new Map(),
    articleCache: new Map(),
    activeViewport: null
  };
}
