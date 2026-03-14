import { createConfigurationPastelRow, createConfigurationSchemeList } from "./configuration-controls.js";

export function createConfigurationPanel(options) {
  const classNames = options && options.classNames ? options.classNames : {};
  const createButton = options && options.createButton;
  const state = options && options.state ? options.state : null;
  const onToggleVisible = options && options.onToggleVisible;
  const onSelectScheme = options && options.onSelectScheme;
  const onPastelChange = options && options.onPastelChange;
  const isEnabled = options && options.isEnabled;

  const wrap = document.createElement("div");
  wrap.className = classNames.wrap || "";

  const sectionTitle = document.createElement("div");
  sectionTitle.className = classNames.sectionTitle || "";
  sectionTitle.textContent = options && options.titleText ? options.titleText : "Configuration";
  wrap.appendChild(sectionTitle);

  const toggle = createButton(
    options && options.toggleText ? options.toggleText : "Color Schemes",
    classNames.toggle || "",
    () => {
      if (typeof onToggleVisible === "function") {
        onToggleVisible();
      }
    }
  );
  wrap.appendChild(toggle);

  const visible = Boolean(state && state.colorSchemesVisible);
  if (!visible) {
    return wrap;
  }

  wrap.appendChild(createConfigurationSchemeList({
    listClassName: classNames.schemeList || "",
    buttonClassName: classNames.schemeButton || "",
    schemes: state && Array.isArray(state.schemes) ? state.schemes : [],
    selectedKey: state && typeof state.selectedSchemeKey === "string" ? state.selectedSchemeKey : "",
    isEnabled,
    onClick(scheme) {
      if (typeof onSelectScheme === "function") {
        onSelectScheme(scheme);
      }
    }
  }));

  wrap.appendChild(createConfigurationPastelRow({
    rowClassName: classNames.pastelRow || "",
    labelClassName: classNames.pastelLabel || "",
    labelText: options && options.pastelLabelText ? options.pastelLabelText : "Pastel base:",
    initialHex: state && typeof state.pastelBaseColor === "string" ? state.pastelBaseColor : "#B76DC9",
    onChange(nextHex) {
      if (typeof onPastelChange === "function") {
        onPastelChange(nextHex);
      }
    }
  }));

  return wrap;
}
