/**
 * Cross-links to sibling services in the Weien Wong platform ecosystem.
 * Rendered in the site footer so crawlers and answer engines can discover
 * every service from any single page. `self` is filtered out at render time.
 */
export const SELF_ID = "sport";

export const ECOSYSTEM_SITES = [
  { id: "hub", url: "https://weienwong.online/", anchor: "Weien Wong Platform Hub", blurb: "Single sign-on hub and directory for every service." },
  { id: "reddit", url: "https://reddit.weienwong.online/", anchor: "Reddit Dataset Scraper", blurb: "Keyword, user, and subreddit Reddit datasets for AI." },
  { id: "twitter", url: "https://twitter.weienwong.online/", anchor: "Twitter / X Dataset Scraper", blurb: "Keyword, hashtag, and account-level X datasets." },
  { id: "aicontent", url: "https://aicontent.weienwong.online/", anchor: "AI Content Generator", blurb: "Generate images, GIFs, and written content from prompts." },
  { id: "aidetect", url: "https://aidetect.weienwong.online/", anchor: "AI Content Detector", blurb: "Check whether text or images were AI-generated." },
  { id: "voice", url: "https://voiceagent.weienwong.online/", anchor: "Multilingual Voice Assistant", blurb: "Practise conversation scenarios in multiple languages." },
  { id: "crypto", url: "https://cryptodataset.weienwong.online/", anchor: "Crypto Market Data & Candles", blurb: "Historical Binance OHLCV candle data and charts." },
  { id: "bittensor", url: "https://bittensor.weienwong.online/", anchor: "Bittensor Subnet Dashboard", blurb: "Track Bittensor subnets, miner pools, and validators." },
  { id: "sport", url: "https://sport.weienwong.online/", anchor: "Sports Odds Research & Guides", blurb: "Guides on odds formats, probability, and markets." },
  { id: "business", url: "https://googlemap.weienwong.online/", anchor: "Google Maps Business Lead Finder", blurb: "Collect business contact data from Google Maps." }
];

export const SIBLING_SITES = ECOSYSTEM_SITES.filter((s) => s.id !== SELF_ID);
