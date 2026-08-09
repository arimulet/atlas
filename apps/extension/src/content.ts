import { extractPlayerSnapshot, extractYouthAcademySnapshot } from "./domParser";

interface ExtractMessage {
  type: "ATLAS_EXTRACT_SNAPSHOT";
}

chrome.runtime.onMessage.addListener((message: ExtractMessage, _sender, sendResponse) => {
  if (message.type !== "ATLAS_EXTRACT_SNAPSHOT") {
    return false;
  }

  try {
    const isYouthAcademy = document.querySelector("[data-atlas-youth-academy]") !== null || 
                           document.body.textContent?.toLowerCase().includes("juniors") ||
                           window.location.href.includes("juniors") || 
                           window.location.href.includes("youth");
                           
    const options = {
      pageUrl: window.location.href,
      locale: document.documentElement.lang || navigator.language
    };

    const result = isYouthAcademy ? extractYouthAcademySnapshot(document, options) : extractPlayerSnapshot(document, options);

    sendResponse({
      ok: true,
      result
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown extraction error."
    });
  }

  return false;
});
