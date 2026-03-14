import { createConfigurationPastelRow, createConfigurationSchemeList } from "./configuration-controls.js";

export function createConfigurationPanel(options) {
  const classNames = options && options.classNames ? options.classNames : {};
  const createButton = options && options.createButton;
  const state = options && options.state ? options.state : null;
  const mode = options && typeof options.mode === "string" ? options.mode : "overview";
  const onOpenColorSchemes = options && options.onOpenColorSchemes;
  const onOpenScreenResolutions = options && options.onOpenScreenResolutions;
  const onBack = options && options.onBack;
  const onSelectScheme = options && options.onSelectScheme;
  const onPastelChange = options && options.onPastelChange;
  const onSetViewportMode = options && options.onSetViewportMode;
  const isEnabled = options && options.isEnabled;

  const wrap = document.createElement("div");
  wrap.className = classNames.wrap || "";

  const sectionTitle = document.createElement("div");
  sectionTitle.className = classNames.sectionTitle || "";
  sectionTitle.textContent = options && options.titleText ? options.titleText : "Configuration";
  wrap.appendChild(sectionTitle);

  const actions = document.createElement("div");
  actions.className = classNames.actionsRow || "";
  if (mode === "overview") {
    actions.appendChild(createButton(
      options && options.toggleText ? options.toggleText : "Color Schemes",
      classNames.toggle || "",
      () => {
        if (typeof onOpenColorSchemes === "function") {
          onOpenColorSchemes();
        }
      }
    ));
    actions.appendChild(createButton(
      "Screen Resolutions",
      classNames.toggle || "",
      () => {
        if (typeof onOpenScreenResolutions === "function") {
          onOpenScreenResolutions();
        }
      }
    ));
    wrap.appendChild(actions);
    return wrap;
  }

  actions.appendChild(createButton(
    "Back",
    classNames.toggle || "",
    () => {
      if (typeof onBack === "function") {
        onBack();
      }
    }
  ));
  wrap.appendChild(actions);

  if (mode === "screen-resolutions") {
    const resolutions = document.createElement("div");
    resolutions.className = classNames.resolutionList || "";
    const currentViewportMode = state && typeof state.viewportMode === "string" ? state.viewportMode : "auto";
    [
      { label: "Responsive 360-720-1080+", mode: "auto" },
      { label: "Static 360", mode: "static-360" },
      { label: "Static 720", mode: "static-720" },
      { label: "Static 1080", mode: "static-1080" }
    ].forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = (classNames.resolutionButton || "")
        + (currentViewportMode === entry.mode ? " active" : "");
      button.textContent = entry.label;
      button.addEventListener("click", () => {
        if (typeof onSetViewportMode === "function") {
          onSetViewportMode(entry.mode);
        }
      });
      resolutions.appendChild(button);
    });
    wrap.appendChild(resolutions);
    return wrap;
  }

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
