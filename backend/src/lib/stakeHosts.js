/** True if URL host is Stake (any regional TLD we care about). */
export function isStakeHostUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      h === "stake.com" ||
      h === "stake.de" ||
      h.endsWith(".stake.com") ||
      h.endsWith(".stake.de")
    );
  } catch {
    return false;
  }
}
