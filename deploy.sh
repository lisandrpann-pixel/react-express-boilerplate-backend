#!/usr/bin/env bash
# Обновление и перезапуск приложения на сервере.
#
# Лежит в backend/ (репозиторий backend), рядом с ним клонируется frontend:
#   /opt/app/backend/deploy.sh
#   /opt/app/frontend/
# поэтому корень — родительская директория скрипта.
#
# Использование:  ./deploy.sh
# Откат:          cd backend && git reset --hard <коммит> && ./deploy.sh

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$BACKEND_DIR")"

echo "==> backend: git pull"
git -C "$BACKEND_DIR" pull --ff-only

echo "==> frontend: git pull"
git -C "$APP_DIR/frontend" pull --ff-only

echo "==> docker compose up -d --build"
docker compose -f "$BACKEND_DIR/docker-compose.yml" up -d --build

echo "==> Статус:"
docker compose -f "$BACKEND_DIR/docker-compose.yml" ps
