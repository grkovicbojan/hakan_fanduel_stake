export function isStakeHostUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const h = new URL(url.trim()).hostname.toLowerCase();
    return h === "stake.com" || h.endsWith(".stake.com");
  } catch {
    return false;
  }
}
