export function createNavAreaController(options) {
  const allowedModes = new Set(Array.isArray(options && options.allowedModes) ? options.allowedModes : []);
  const fallbackMode = options && Object.prototype.hasOwnProperty.call(options, "fallbackMode")
    ? options.fallbackMode
    : null;
  const allowNull = Boolean(options && options.allowNull);
  const aliases = options && options.aliases && typeof options.aliases === "object"
    ? options.aliases
    : {};

  function normalize(requested) {
    if (requested === null && allowNull) {
      return null;
    }
    const mapped = Object.prototype.hasOwnProperty.call(aliases, requested)
      ? aliases[requested]
      : requested;
    if (allowedModes.has(mapped)) {
      return mapped;
    }
    return fallbackMode;
  }

  return {
    normalize
  };
}
