function normalizeHexColor(color, fallback) {
  if (typeof color !== "string") {
    return fallback;
  }
  const value = color.trim();
  const shortHex = value.match(/^#([0-9a-f]{3})$/i);
  if (shortHex) {
    const parts = shortHex[1].split("");
    return "#" + parts.map((part) => part + part).join("").toUpperCase();
  }
  const longHex = value.match(/^#([0-9a-f]{6})$/i);
  if (longHex) {
    return "#" + longHex[1].toUpperCase();
  }
  return fallback;
}

function parseHex(hex) {
  const normalized = normalizeHexColor(hex, "#B76DC9");
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(rgb) {
  return "#" + [rgb.r, rgb.g, rgb.b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function tint(hex, ratio) {
  const rgb = parseHex(hex);
  return toHex({
    r: rgb.r + (255 - rgb.r) * ratio,
    g: rgb.g + (255 - rgb.g) * ratio,
    b: rgb.b + (255 - rgb.b) * ratio
  });
}

function shade(hex, ratio) {
  const rgb = parseHex(hex);
  return toHex({
    r: rgb.r * (1 - ratio),
    g: rgb.g * (1 - ratio),
    b: rgb.b * (1 - ratio)
  });
}

export function getReadableTextColor(backgroundHex) {
  const rgb = parseHex(backgroundHex);
  const y = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return y > 0.62 ? "#111111" : "#FFFFFF";
}

export const BASE_COLOR_SCHEMES = [
  {
    key: "terminal-mono",
    label: "Terminal Mono",
    preview: { surface: "#07120A", layer: "#020703", text: "#6CFF7D", border: "#2B6033", interactive: "#0D2312", accent: "#00FF66", placeholder: "#0B1A0E" }
  },
  {
    key: "brutalist-rgb",
    label: "Brutalist RGB",
    preview: { surface: "#FFFFFF", layer: "#FFF200", text: "#000000", border: "#000000", interactive: "#FF2D2D", accent: "#00D95F", placeholder: "#F3F3F3" }
  },
  {
    key: "newspaper-print",
    label: "Newspaper Print",
    preview: { surface: "#F7F1E4", layer: "#FFFAF0", text: "#1A1A1A", border: "#5B574D", interactive: "#E8DFCD", accent: "#B22222", placeholder: "#EFE6D6" }
  },
  {
    key: "neon-cyber",
    label: "Neon Cyber",
    preview: { surface: "#130022", layer: "#0A0013", text: "#F4E8FF", border: "#6A2F8F", interactive: "#2A0D43", accent: "#FF2EC4", placeholder: "#1B0A2B" }
  },
  {
    key: "clinical-white",
    label: "Clinical White",
    preview: { surface: "#FBFEFF", layer: "#FFFFFF", text: "#0F2230", border: "#9DC0D8", interactive: "#E8F3FA", accent: "#1976D2", placeholder: "#F3F7FA" }
  },
  {
    key: "retro-gameboy",
    label: "Retro Gameboy",
    preview: { surface: "#9BBC0F", layer: "#8BAC0F", text: "#0F380F", border: "#306230", interactive: "#7EA028", accent: "#0F380F", placeholder: "#A6C63E" }
  },
  {
    key: "luxury-gold",
    label: "Luxury Gold",
    preview: { surface: "#101010", layer: "#181818", text: "#F2E4C4", border: "#8C6B2F", interactive: "#201A10", accent: "#D4AF37", placeholder: "#16130D" }
  },
  {
    key: "dark",
    label: "Dark",
    preview: { surface: "#1A1E24", layer: "#11151A", text: "#E7EDF4", border: "#36414F", interactive: "#273141", accent: "#5C9DFF", placeholder: "#212833" }
  },
  {
    key: "high-contrast",
    label: "High Contrast",
    preview: { surface: "#FFFFFF", layer: "#FFFFFF", text: "#000000", border: "#000000", interactive: "#000000", accent: "#FFCC00", placeholder: "#F2F2F2" }
  },
  {
    key: "pastel-dynamic",
    label: "Pastel (Dynamic)",
    preview: { surface: "#FDF7FF", layer: "#FFFFFF", text: "#3B2A44", border: "#DECDE8", interactive: "#F2E8F7", accent: "#B76DC9", placeholder: "#F7EFFA" }
  }
];

export function resolveColorSchemes(pastelBaseColor) {
  const pastelBase = normalizeHexColor(pastelBaseColor, "#B76DC9");
  return BASE_COLOR_SCHEMES.map((scheme) => {
    if (scheme.key !== "pastel-dynamic") {
      return {
        key: scheme.key,
        label: scheme.label,
        preview: Object.assign({}, scheme.preview)
      };
    }
    const preview = {
      surface: tint(pastelBase, 0.88),
      layer: "#FFFFFF",
      text: shade(pastelBase, 0.72),
      border: tint(pastelBase, 0.62),
      interactive: tint(pastelBase, 0.75),
      accent: pastelBase,
      placeholder: tint(pastelBase, 0.82)
    };
    return {
      key: scheme.key,
      label: scheme.label,
      preview
    };
  });
}

export function normalizePastelBaseColor(color, fallback) {
  return normalizeHexColor(color, normalizeHexColor(fallback, "#B76DC9"));
}
