#!/usr/bin/env node
/**
 * @deprecated Одноразовая миграция: ручные предметы из старого items.js → JSON.
 * Каталог уже объединён; для правок используйте только tools/items-migrated.json.
 */

console.error(
  "merge-manual-items-into-json.js: миграция уже выполнена. Правьте tools/items-migrated.json и запустите bash tools/build-catalog.sh",
);
process.exit(0);
