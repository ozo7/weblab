export function createViewport720Stub(options) {
  const host = options.host;
  host.innerHTML = [
    '<div class="wv-stub">',
    '  <main id="pane2main">',
    '    <h2>720 viewport stub</h2>',
    '    <p>This profile is intentionally inactive in this step.</p>',
    '  </main>',
    '</div>'
  ].join("\n");

  return {
    key: "720",
    articlePane: host.querySelector("#pane2main"),
    teardown() {
      host.innerHTML = "";
    }
  };
}
