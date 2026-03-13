export function createViewport360Stub(options) {
  const host = options.host;
  host.innerHTML = [
    '<div class="wv-stub">',
    '  <main id="pane2main">',
    '    <h2>360 viewport stub</h2>',
    '    <p>This profile is intentionally inactive in this step.</p>',
    '  </main>',
    '</div>'
  ].join("\n");

  return {
    key: "360",
    articlePane: host.querySelector("#pane2main"),
    teardown() {
      host.innerHTML = "";
    }
  };
}
