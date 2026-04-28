import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractFanduelSportbookDetails } from "../backend/src/extractors/fanduel.js";

function escapeCsv(value) {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
}

async function main() {
  const htmlPathArg = process.argv[2];
  const websiteUrlArg = process.argv[3] || "https://sportsbook.fanduel.com/";
  const outputCsvArg = process.argv[4];

  if (!htmlPathArg) {
    throw new Error(
      "Usage: node scripts/extract-fanduel-odds-to-csv.mjs <htmlPath> [websiteUrl] [outputCsvPath]"
    );
  }

  const htmlPath = path.resolve(htmlPathArg);
  const html = await readFile(htmlPath, "utf8");
  const rows = extractFanduelSportbookDetails(html, websiteUrlArg);

  const csvPath =
    outputCsvArg && outputCsvArg.trim()
      ? path.resolve(outputCsvArg)
      : path.join(path.dirname(htmlPath), `${path.parse(htmlPath).name}.odds.csv`);

  const header = "url,category,value";
  const lines = rows.map((row) =>
    [row?.url ?? "", row?.category ?? "", row?.value ?? ""].map(escapeCsv).join(",")
  );
  await writeFile(csvPath, `${header}\n${lines.join("\n")}\n`, "utf8");

  console.log(`Extracted ${rows.length} rows`);
  console.log(`Saved CSV: ${csvPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
