#!/bin/sh
# Сборка каталога: пул v120 → items-migrated.json → items-catalog.js
set -e
cd "$(dirname "$0")/.."

case "${1:-}" in
  -h|--help)
    echo "Использование: bash tools/build-catalog.sh"
    echo ""
    echo "  Пул v120:  tools/generate-item-pool-120.mjs"
    echo "  Источник:  tools/items-migrated.json (только 120 предметов)"
    echo "  Результат: items-catalog.js"
    exit 0
    ;;
esac

node tools/generate-item-pool-120.mjs
echo "Готово."
