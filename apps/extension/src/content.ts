import { extractPlayerSnapshot } from "./domParser";

interface ExtractMessage {
  type: "ATLAS_EXTRACT_SNAPSHOT";
}

chrome.runtime.onMessage.addListener((message: ExtractMessage, _sender, sendResponse) => {
  if (message.type !== "ATLAS_EXTRACT_SNAPSHOT") {
    return false;
  }

  try {
    sendResponse({
      ok: true,
      result: extractPlayerSnapshot(document, {
        pageUrl: window.location.href,
        locale: document.documentElement.lang || navigator.language
      })
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown extraction error."
    });
  }

  return false;
});
