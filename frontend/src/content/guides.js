/** Editorial guides (content pages only — no ads on /dashboard). */
export const GUIDES = [
  {
    slug: "odds-formats",
    path: "/guides/odds-formats",
    title: "American, decimal, and fractional odds explained",
    summary:
      "How to read each format, convert between them, and avoid comparison mistakes caused by rounding.",
    readMinutes: 8
  },
  {
    slug: "implied-probability",
    path: "/guides/implied-probability",
    title: "Implied probability and bookmaker margin (vig)",
    summary:
      "What posted prices imply about outcomes, why sums exceed 100%, and how margin affects research.",
    readMinutes: 9
  },
  {
    slug: "arbitrage-research",
    path: "/guides/arbitrage-research",
    title: "Why percentage gaps are not “free money”",
    summary:
      "Stale lines, limits, void rules, and category mismatches that make arbitrage metrics misleading.",
    readMinutes: 10
  },
  {
    slug: "player-props",
    path: "/guides/player-props",
    title: "Player props and matching markets across books",
    summary:
      "Over/under lines, alternate thresholds, and naming differences when comparing two sources.",
    readMinutes: 8
  },
  {
    slug: "responsible-gambling",
    path: "/guides/responsible-gambling",
    title: "Responsible gambling and legal awareness",
    summary:
      "Risk limits, self-exclusion resources, and why this site does not accept wagers.",
    readMinutes: 6
  },
  {
    slug: "moneyline-and-spreads",
    path: "/guides/moneyline-and-spreads",
    title: "Moneyline, spreads, and game totals explained",
    summary:
      "Core team-level markets, how handicaps work, and what researchers compare across books.",
    readMinutes: 9
  },
  {
    slug: "line-movement",
    path: "/guides/line-movement",
    title: "Understanding line movement and closing lines",
    summary:
      "Why prices change before kickoff, steam moves, and how timing affects comparisons.",
    readMinutes: 8
  },
  {
    slug: "research-ethics",
    path: "/guides/research-ethics",
    title: "Ethics, terms of service, and lawful data collection",
    summary:
      "Respecting operator rules, geo restrictions, and using data only where permitted.",
    readMinutes: 7
  }
];

export function guideBySlug(slug) {
  return GUIDES.find((g) => g.slug === slug);
}
