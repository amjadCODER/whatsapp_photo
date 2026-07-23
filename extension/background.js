function waitForTabComplete(tabId, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("انتهى وقت انتظار تحميل WhatsApp Web"));
    }, timeout);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function getWhatsAppTab(url) {
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (tabs.length) {
    return chrome.tabs.update(tabs[0].id, { url, active: true });
  }
  return chrome.tabs.create({ url, active: true });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "WA_HELPER_PING") {
    sendResponse({
      ok: true,
      version: chrome.runtime.getManifest().version
    });
    return;
  }

  if (message?.type === "WA_HELPER_PREPARE") {
    (async () => {
      const payload = message.payload || {};
      const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(payload.phone || "")}&text=${encodeURIComponent(payload.message || "")}`;
      const tab = await getWhatsAppTab(url);
      await waitForTabComplete(tab.id);

      // Give WhatsApp Web a short moment to render the conversation.
      await new Promise(resolve => setTimeout(resolve, 1800));

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "WA_HELPER_ATTACH_IMAGE",
        imageDataUrl: payload.imageDataUrl || null,
        fileName: payload.fileName || "campaign-image.png"
      });

      sendResponse({
        ok: Boolean(response?.ok),
        error: response?.error || null
      });
    })().catch(error => {
      sendResponse({ ok: false, error: error.message });
    });

    return true;
  }
});
