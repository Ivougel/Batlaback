#!/bin/sh
# Сборка items-bb-catalog.js из tools/items-migrated.json
set -e
cd "$(dirname "$0")/.."

case "${1:-}" in
  -h|--help)
    echo "Использование: bash tools/build-catalog.sh"
    echo ""
    echo "  Источник:  tools/items-migrated.json"
    echo "  Результат: items-bb-catalog.js"
    exit 0
    ;;
esac

node tools/generate-bb-catalog.js
echo "Готово."
