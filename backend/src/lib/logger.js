import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

const stamp = () => new Date().toISOString();

const logDir = env.logDir;
const htmlDumpDir = path.join(logDir, "html");

let ensuredDirs = false;

function ensureLogDirs() {
  if (ensuredDirs) return;
  fs.mkdirSync(htmlDumpDir, { recursive: true });
  ensuredDirs = true;
}

function appLogFilePath() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `app-${day}.log`);
}

/** Avoid multi-megabyte lines in the log file or console when meta embeds HTML. */
function formatMeta(meta, maxString = 800) {
  if (meta == null || meta === "") return "";
  if (typeof meta !== "object") return String(meta);
  try {
    return JSON.stringify(meta, (_k, value) => {
      if (typeof value === "string" && value.length > maxString) {
        return `[string ${value.length} chars, truncated for log]`;
      }
      return value;
    });
  } catch {
    return String(meta);
  }
}

function appendAppLine(level, line) {
  try {
    ensureLogDirs();
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(appLogFilePath(), line + "\n", "utf8");
  } catch (err) {
    console.error(`[logger] failed to append log file: ${err.message}`);
  }
}

function emit(level, consoleFn, message, meta) {
  const suffix = formatMeta(meta);
  const line = `[${stamp()}] [${level}] ${message}${suffix ? ` ${suffix}` : ""}`;
  consoleFn(line);
  appendAppLine(level, line);
}

/**
 * Write full HTML (or any large string) to logs/html/*.html and log a short pointer to app-*.log.
 * @returns {string|null} absolute path written, or null if skipped
 */
export function writeHtmlDump({ websiteUrl = "", html, tag = "dump" } = {}) {
  if (html == null || typeof html !== "string") {
    emit("WARN", console.warn, "writeHtmlDump: missing html", { websiteUrl, tag });
    return null;
  }
  try {
    ensureLogDirs();
    const slug = String(websiteUrl || "unknown")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 96);
    const t = stamp().replace(/[:.]/g, "-");
    const safeTag = String(tag).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64);
    const fileName = `${t}_${slug}_${safeTag}.html`;
    const absPath = path.join(htmlDumpDir, fileName);
    fs.writeFileSync(absPath, html, "utf8");
    const kb = (html.length / 1024).toFixed(1);
    emit("INFO", console.log, `HTML dump written (${kb} KiB)`, {
      file: absPath,
      websiteUrl: websiteUrl || undefined,
      tag
    });
    return absPath;
  } catch (err) {
    emit("ERROR", console.error, "writeHtmlDump failed", { error: err.message, websiteUrl, tag });
    return null;
  }
}

export const logger = {
  info(message, meta) {
    emit("INFO", console.log, message, meta);
  },
  warn(message, meta) {
    emit("WARN", console.warn, message, meta);
  },
  error(message, meta) {
    emit("ERROR", console.error, message, meta);
  },
  writeHtmlDump
};
