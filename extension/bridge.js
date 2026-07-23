window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;

  if (event.data.type === "WA_SITE_PING_EXTENSION") {
    chrome.runtime.sendMessage({ type: "WA_HELPER_PING" }, (response) => {
      window.postMessage({
        type: "WA_EXTENSION_RESPONSE",
        action: "PING",
        ok: Boolean(response?.ok),
        version: response?.version || null
      }, "*");
    });
  }

  if (event.data.type === "WA_SITE_PREPARE_MESSAGE") {
    chrome.runtime.sendMessage({
      type: "WA_HELPER_PREPARE",
      payload: event.data.payload
    }, (response) => {
      window.postMessage({
        type: "WA_EXTENSION_RESPONSE",
        action: "PREPARE",
        ok: Boolean(response?.ok),
        error: response?.error || chrome.runtime.lastError?.message || null
      }, "*");
    });
  }
});

window.postMessage({
  type: "WA_EXTENSION_RESPONSE",
  action: "READY",
  ok: true
}, "*");
