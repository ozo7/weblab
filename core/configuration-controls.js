import { createColorPicker } from "./color-picker.js";
import { getReadableTextColor } from "./color-schemes.js";

function safeColor(value, fallback) {
  return typeof value === "string" && value ? value : fallback;
}

export function createConfigurationSchemeList(options) {
  const list = document.createElement("div");
  list.className = typeof options.listClassName === "string" ? options.listClassName : "";

  const schemes = Array.isArray(options.schemes) ? options.schemes : [];
  const selectedKey = typeof options.selectedKey === "string" ? options.selectedKey : "";
  const includeScheme = typeof options.includeScheme === "function"
    ? options.includeScheme
    : () => true;
  const onClick = typeof options.onClick === "function" ? options.onClick : () => {};
  const buttonClassName = typeof options.buttonClassName === "string" ? options.buttonClassName : "";
  const isEnabled = typeof options.isEnabled === "function" ? options.isEnabled : () => true;

  schemes.forEach((scheme) => {
    if (!scheme || !includeScheme(scheme)) {
      return;
    }
    const preview = scheme.preview && typeof scheme.preview === "object" ? scheme.preview : {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = buttonClassName + (selectedKey === scheme.key ? " active" : "");
    button.textContent = scheme.label;
    button.style.background = safeColor(preview.interactive, "#E5F1E8");
    button.style.color = getReadableTextColor(safeColor(preview.interactive, "#E5F1E8"));
    button.style.borderColor = safeColor(preview.border, "#B8CABC");
    button.disabled = !isEnabled(scheme);
    button.addEventListener("click", () => onClick(scheme));
    list.appendChild(button);
  });

  return list;
}

export function createConfigurationPastelRow(options) {
  const row = document.createElement("div");
  row.className = typeof options.rowClassName === "string" ? options.rowClassName : "";

  const label = document.createElement("label");
  label.className = typeof options.labelClassName === "string" ? options.labelClassName : "";
  label.textContent = typeof options.labelText === "string" ? options.labelText : "Pastel base:";
  row.appendChild(label);

  const pickerHost = document.createElement("div");
  row.appendChild(pickerHost);

  createColorPicker({
    host: pickerHost,
    initialHex: typeof options.initialHex === "string" ? options.initialHex : "#B76DC9",
    onChange(nextHex) {
      if (typeof options.onChange === "function") {
        options.onChange(nextHex);
      }
    }
  });

  return row;
}
