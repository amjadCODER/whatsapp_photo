function waitForAny(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const find = () => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }
      return null;
    };

    const initial = find();
    if (initial) return resolve(initial);

    const observer = new MutationObserver(() => {
      const element = find();
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error("تعذر العثور على عنصر إرفاق الصورة داخل WhatsApp Web"));
    }, timeout);
  });
}

function dataUrlToFile(dataUrl, fileName) {
  const [header, encoded] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: mime });
}

async function attachImage(imageDataUrl, fileName) {
  if (!imageDataUrl) return;

  const attachIcon = await waitForAny([
    '[data-icon="plus-rounded"]',
    '[data-icon="clip"]',
    'button[aria-label*="Attach"]',
    'button[aria-label*="إرفاق"]'
  ]);

  const attachButton = attachIcon.closest('button,[role="button"]') || attachIcon;
  attachButton.click();

  await new Promise(resolve => setTimeout(resolve, 700));

  const fileInputs = [...document.querySelectorAll('input[type="file"]')];
  const imageInput =
    fileInputs.find(input => (input.accept || "").includes("image")) ||
    fileInputs.at(-1);

  if (!imageInput) {
    throw new Error("تعذر العثور على حقل اختيار الصورة");
  }

  const transfer = new DataTransfer();
  transfer.items.add(dataUrlToFile(imageDataUrl, fileName));
  imageInput.files = transfer.files;
  imageInput.dispatchEvent(new Event("change", { bubbles: true }));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "WA_HELPER_ATTACH_IMAGE") return;

  (async () => {
    await waitForAny(["#main"], 45000);
    await attachImage(message.imageDataUrl, message.fileName);
    sendResponse({ ok: true });
  })().catch(error => {
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});
