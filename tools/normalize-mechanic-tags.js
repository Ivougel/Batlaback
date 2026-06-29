#!/usr/bin/env node
/**
 * Нормализует описания предметов: «тег» → [тег], триггеры → [при попадании] и т.д.
 * Запуск: node tools/normalize-mechanic-tags.js [--write]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = [
  path.join(ROOT, "items-bb-catalog.js"),
  path.join(ROOT, "items.js"),
];

const MECHANIC_TRIGGER_REPLACEMENTS = [
  ["При входе в магазин", "[при входе в магазин]"],
  ["В начале боя", "В [начале боя]"],
  ["При попадании", "[при попадании]"],
  ["При промахе", "[при промахе]"],
  ["При атаке", "[при атаке]"],
  ["При блоке", "[при блоке]"],
  ["Пассивно", "[пассивно]"],
];

function normalizeMechanicTags(text) {
  if (text == null || text === "") return text;
  let s = String(text);

  if (/\[[^\]]+\]/.test(s) && !/«/.test(s) && !MECHANIC_TRIGGER_REPLACEMENTS.some(([from]) => s.includes(from))) {
    return s;
  }

  s = s.replace(/«([^»]+)»/g, "[$1]");
  s = s.replace(/“([^”]+)”/g, "[$1]");

  MECHANIC_TRIGGER_REPLACEMENTS.forEach(([from, to]) => {
    s = s.split(from).join(to);
  });

  s = s.replace(/за каждый предмет \[([^\]]+)\]/g, "за каждый предмет с [$1]");
  s = s.replace(/за предмет \[([^\]]+)\]/g, "за предмет с [$1]");
  s = s.replace(/с каждым предметом \[([^\]]+)\]/g, "с каждым предметом с [$1]");

  return s;
}

function patchQuotedField(src, fieldName) {
  let changes = 0;
  const re = new RegExp(`(${fieldName}:\\s*")((?:\\\\.|[^"\\\\])*)(")`, "g");
  const out = src.replace(re, (match, pre, body, post) => {
    const decoded = body.replace(/\\"/g, '"').replace(/\\n/g, "\n");
    const next = normalizeMechanicTags(decoded);
    if (next === decoded) return match;
    changes += 1;
    const encoded = next
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
    return `${pre}${encoded}${post}`;
  });
  return { out, changes };
}

function patchFile(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  let out = src;
  let changes = 0;
  ["description", "desc", "buildHints"].forEach((field) => {
    const result = patchQuotedField(out, field);
    out = result.out;
    changes += result.changes;
  });
  return { out, changes };
}

const write = process.argv.includes("--write");
let total = 0;

FILES.forEach((filePath) => {
  const { out, changes } = patchFile(filePath);
  total += changes;
  const rel = path.relative(ROOT, filePath);
  if (write && changes > 0) {
    fs.writeFileSync(filePath, out);
    console.log(`${rel}: обновлено ${changes} описаний`);
  } else {
    console.log(`${rel}: ${changes} описаний${write ? "" : " (dry-run, добавь --write)"}`);
  }
});

console.log(`Итого: ${total} описаний`);
