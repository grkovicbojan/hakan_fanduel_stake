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

  function isStakePage() {
    const h = window.location.hostname.toLowerCase();
    return h === "stake.com" || h.endsWith(".stake.com");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function parseStakeFixtureParts() {
    const u = new URL(window.location.href);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const idx = parts.indexOf("sports");
    const sportSlug = idx >= 0 && parts[idx + 1] ? parts[idx + 1].toLowerCase() : "basketball";
    const m = /^(\d{4,})-/.exec(last);
    return { sportSlug, numericId: m ? m[1] : "", pathSlug: last };
  }

  function sportEventMatchesFixture(node, { numericId, pathSlug }) {
    if (!node || typeof node !== "object") return false;
    if (numericId) {
      const id = String(node.id ?? "");
      if (id === numericId || id.includes(numericId)) return true;
    }
    const slug = String(node.slug ?? node.extSlug ?? "");
    if (pathSlug && slug && (slug === pathSlug || slug.endsWith(pathSlug) || pathSlug.endsWith(slug))) return true;
    const extUrl = String(node.url ?? node.extId ?? "");
    if (numericId && extUrl.includes(numericId)) return true;
    return false;
  }

  /**
   * Loads the current fixture’s markets via Stake’s GraphQL API (same tab origin; no HTML scraping).
   * @param {string} accessToken
   */
  async function fetchStakeFixtureGraphqlPayload(accessToken) {
    const fixtureUrl = window.location.href;
    const keys = parseStakeFixtureParts();
    const endpoint = `${window.location.origin}/_api/graphql`;
    const headers = {
      "content-type": "application/json",
      Accept: "application/json, application/graphql+json",
      "x-language": "en",
      Origin: window.location.origin,
      Referer: fixtureUrl
    };
    const tok = String(accessToken || "").trim();
    if (tok) headers["x-access-token"] = tok;

    const query = `query SportsEvents($first: Int!, $sportSlug: String!, $after: String) {
  sportsEvents(first: $first, sportSlug: $sportSlug, after: $after) {
    edges {
      cursor
      node {
        id
        name
        markets {
          name
          outcomes {
            name
            odds
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

    let after = null;
    let pages = 0;
    const maxPages = 40;
    while (pages < maxPages) {
      pages += 1;
      const body = {
        operationName: "SportsEvents",
        query,
        variables: {
          first: 50,
          sportSlug: keys.sportSlug,
          after
        }
      };
      const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), credentials: "include" });
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        return {
          stakeGraphqlV1: true,
          fixtureUrl,
          event: null,
          error: "invalid_json",
          status: res.status,
          sample: text?.slice(0, 200)
        };
      }
      if (json?.errors?.length) {
        return {
          stakeGraphqlV1: true,
          fixtureUrl,
          event: null,
          error: json.errors.map((e) => e.message).join("; "),
          status: res.status
        };
      }
      const conn = json?.data?.sportsEvents;
      const edges = Array.isArray(conn?.edges) ? conn.edges : [];
      for (const edge of edges) {
        const node = edge?.node;
        if (sportEventMatchesFixture(node, keys)) {
          return { stakeGraphqlV1: true, fixtureUrl, event: node };
        }
      }
      const pi = conn?.pageInfo;
      if (!pi?.hasNextPage || !pi?.endCursor) break;
      after = pi.endCursor;
    }
    return {
      stakeGraphqlV1: true,
      fixtureUrl,
      event: null,
      error: "fixture_not_found_in_sportsEvents",
      keys
    };
  }

  /**
   * FanDuel: expandable accordions. Stake fixture pages use GraphQL (see FETCH_STAKE_GRAPHQL_ODDS), not DOM scraping.
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

    if (isStakePage()) {
      /** Stake subs no longer use accordion targets; return 1 so legacy “has targets” checks pass when needed. */
      targetHitCount = 1;
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
    if (message?.type === "FETCH_STAKE_GRAPHQL_ODDS") {
      (async () => {
        if (!isStakePage()) {
          sendResponse({ ok: false, error: "not_stake_page" });
          return;
        }
        const payload = await fetchStakeFixtureGraphqlPayload(message.accessToken);
        sendResponse({ ok: true, jsonText: JSON.stringify(payload) });
      })().catch((e) => {
        sendResponse({ ok: false, error: String(e?.message || e) });
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
