(function initSportBetContentScript() {
  const INIT_KEY = "__sportBetContentScriptInitialized";
  if (globalThis[INIT_KEY]) {
    console.log("[SportBet CS] content.js re-entry skipped (already initialized)", window.location.href);
    return;
  }
  globalThis[INIT_KEY] = true;

  console.log("[SportBet CS] content.js loaded", window.location.href);

  const FAN_DUEL_HOST = "sportsbook.fanduel.com";
  const FAN_DUEL_EXPANDABLE_SELECTOR = "main ul li [aria-expanded]";
  const FAN_DUEL_EXPANDABLE_SELECTOR_2ND = "main ul li [aria-expanded='false']";
  const CLICK_TAG_TIME_MS = 2000;

  function isFanDuelPage() {
    return window.location.hostname === FAN_DUEL_HOST;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * FanDuel: expandable accordions for player markets.
   * Stake odds are loaded on the backend (Odds Data API); extension does not scrape Stake for odds.
   */
  async function runTargetInteraction(skipClicks) {
    let targetHitCount = 0;

    if (isFanDuelPage()) {
      const nodes = document.querySelectorAll(FAN_DUEL_EXPANDABLE_SELECTOR);
      targetHitCount += nodes.length;
      if (!skipClicks && nodes.length > 0) {
        const nodesToOpen = document.querySelectorAll(FAN_DUEL_EXPANDABLE_SELECTOR_2ND);
        for (const element of nodesToOpen) {
          element.click();
        }
        if (nodesToOpen.length > 0) {
          await sleep(CLICK_TAG_TIME_MS);
        }
      }
    }

    return targetHitCount;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void sender;

    if (message?.type === "COUNT_TARGETS") {
      (async () => {
        const targetHitCount = await runTargetInteraction(true);
        sendResponse({ targetHitCount });
      })().catch(() => {
        sendResponse({ targetHitCount: 0 });
      });
      return true;
    }
    if (message?.type !== "GET_PAGE_HTML") return false;

    (async () => {
      const skipTargetClicks = message.skipTargetClicks === true;
      const targetHitCount = await runTargetInteraction(skipTargetClicks);
      sendResponse({
        html: document.documentElement.outerHTML,
        targetHitCount
      });
    })().catch(() => {
      sendResponse({ html: document.documentElement.outerHTML, targetHitCount: 0 });
    });

    return true;
  });
})();
