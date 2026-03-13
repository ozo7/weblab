function hexToRgb(hex) {
  const match = typeof hex === "string" ? hex.trim().match(/^#([0-9a-f]{6})$/i) : null;
  if (!match) {
    return { r: 183, g: 109, b: 201 };
  }
  return {
    r: Number.parseInt(match[1].slice(0, 2), 16),
    g: Number.parseInt(match[1].slice(2, 4), 16),
    b: Number.parseInt(match[1].slice(4, 6), 16)
  };
}

function rgbToHex(rgb) {
  const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0").toUpperCase();
  return "#" + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);
}

function rgbToHsv(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(hsv) {
  const h = ((Number(hsv.h) % 360) + 360) % 360;
  const s = Math.max(0, Math.min(1, Number(hsv.s)));
  const v = Math.max(0, Math.min(1, Number(hsv.v)));
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255
  };
}

function normalizeHex(hex, fallback) {
  const value = typeof hex === "string" ? hex.trim().toUpperCase() : "";
  return /^#[0-9A-F]{6}$/.test(value) ? value : fallback;
}

function ensureSharedPickerStyles() {
  const styleId = "ww-color-picker-styles";
  if (document.getElementById(styleId)) {
    return;
  }
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = [
    ".ww-color-picker{width:100%;max-width:220px;display:grid;gap:6px;}",
    ".ww-color-picker-box{position:relative;width:100%;height:120px;border-radius:8px;border:1px solid #9fb7a6;cursor:crosshair;}",
    ".ww-color-picker-cursor{position:absolute;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.6);transform:translate(-50%,-50%);pointer-events:none;}",
    ".ww-color-picker-hue{width:100%;margin:0;-webkit-appearance:none;appearance:none;height:14px;border-radius:999px;border:1px solid #9fb7a6;background:linear-gradient(90deg,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%);}",
    ".ww-color-picker-hue::-webkit-slider-runnable-track{height:12px;border-radius:999px;background:transparent;}",
    ".ww-color-picker-hue::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;margin-top:-2px;border-radius:50%;border:2px solid #fff;background:#111;box-shadow:0 0 0 1px rgba(0,0,0,.6);}",
    ".ww-color-picker-hue::-moz-range-track{height:12px;border-radius:999px;background:transparent;}",
    ".ww-color-picker-hue::-moz-range-thumb{width:16px;height:16px;border-radius:50%;border:2px solid #fff;background:#111;box-shadow:0 0 0 1px rgba(0,0,0,.6);}",
    ".ww-color-picker-hex{width:100%;min-height:28px;border:1px solid #9fb7a6;border-radius:8px;padding:4px 8px;font:700 .78rem/1.2 \"Trebuchet MS\",\"Segoe UI\",sans-serif;color:#17301f;background:#fff;}"
  ].join("");
  document.head.appendChild(style);
}

export function createColorPicker(options) {
  const host = options && options.host;
  const onChange = options && typeof options.onChange === "function" ? options.onChange : () => {};
  const initialHex = normalizeHex(options && options.initialHex, "#B76DC9");
  if (!host) {
    return {
      setColor() {},
      getColor() { return initialHex; },
      destroy() {}
    };
  }
  ensureSharedPickerStyles();

  const root = document.createElement("div");
  root.className = "ww-color-picker";

  const box = document.createElement("div");
  box.className = "ww-color-picker-box";
  root.appendChild(box);

  const cursor = document.createElement("div");
  cursor.className = "ww-color-picker-cursor";
  box.appendChild(cursor);

  const hue = document.createElement("input");
  hue.type = "range";
  hue.min = "0";
  hue.max = "360";
  hue.step = "1";
  hue.className = "ww-color-picker-hue";
  root.appendChild(hue);

  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.maxLength = 7;
  hexInput.className = "ww-color-picker-hex";
  root.appendChild(hexInput);

  host.appendChild(root);
  let hsv = rgbToHsv(hexToRgb(initialHex));
  let activePointerId = null;
  let pendingEvent = null;
  let rafToken = null;

  function render() {
    const hueHex = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
    box.style.background =
      "linear-gradient(to top, #000000, rgba(0,0,0,0)), linear-gradient(to right, #ffffff, " + hueHex + ")";
    hue.value = String(Math.round(hsv.h));
    hexInput.value = rgbToHex(hsvToRgb(hsv));
    cursor.style.left = String(Math.round(hsv.s * 100)) + "%";
    cursor.style.top = String(Math.round((1 - hsv.v) * 100)) + "%";
  }

  function emitChange() {
    onChange(rgbToHex(hsvToRgb(hsv)));
  }

  function updateFromBoxEvent(event) {
    const rect = box.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    hsv.s = rect.width > 0 ? x / rect.width : 0;
    hsv.v = rect.height > 0 ? 1 - (y / rect.height) : 0;
    render();
    emitChange();
  }

  function flushPointerUpdate() {
    rafToken = null;
    if (!pendingEvent) {
      return;
    }
    updateFromBoxEvent(pendingEvent);
    pendingEvent = null;
  }

  function enqueuePointerUpdate(event) {
    pendingEvent = event;
    if (rafToken !== null) {
      return;
    }
    rafToken = window.requestAnimationFrame(flushPointerUpdate);
  }

  function onPointerDown(event) {
    activePointerId = event.pointerId;
    box.setPointerCapture(activePointerId);
    enqueuePointerUpdate(event);
  }

  function onPointerMove(event) {
    if (activePointerId !== event.pointerId) {
      return;
    }
    enqueuePointerUpdate(event);
  }

  function onPointerEnd(event) {
    if (activePointerId !== event.pointerId) {
      return;
    }
    if (box.hasPointerCapture(activePointerId)) {
      box.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    enqueuePointerUpdate(event);
  }

  function onHueInput() {
    hsv.h = Number(hue.value);
    render();
    emitChange();
  }

  function onHexChange() {
    const nextHex = normalizeHex(hexInput.value, "");
    if (!nextHex) {
      render();
      return;
    }
    hsv = rgbToHsv(hexToRgb(nextHex));
    render();
    emitChange();
  }

  box.addEventListener("pointerdown", onPointerDown);
  box.addEventListener("pointermove", onPointerMove);
  box.addEventListener("pointerup", onPointerEnd);
  box.addEventListener("pointercancel", onPointerEnd);
  hue.addEventListener("input", onHueInput);
  hexInput.addEventListener("change", onHexChange);

  render();

  return {
    setColor(nextHex) {
      const normalized = normalizeHex(nextHex, "");
      if (!normalized) {
        return;
      }
      hsv = rgbToHsv(hexToRgb(normalized));
      render();
    },
    getColor() {
      return rgbToHex(hsvToRgb(hsv));
    },
    destroy() {
      if (rafToken !== null) {
        window.cancelAnimationFrame(rafToken);
      }
      box.removeEventListener("pointerdown", onPointerDown);
      box.removeEventListener("pointermove", onPointerMove);
      box.removeEventListener("pointerup", onPointerEnd);
      box.removeEventListener("pointercancel", onPointerEnd);
      hue.removeEventListener("input", onHueInput);
      hexInput.removeEventListener("change", onHexChange);
      root.remove();
    }
  };
}
