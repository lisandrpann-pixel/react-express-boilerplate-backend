# react-express-boilerplate — backend part

Express 5 + TypeScript, без ORM и без фреймворка поверх Express

## Структура

```
src/
├── app/                       # сборка и запуск приложения
│   ├── index.ts               # точка входа: middleware, роуты, graceful shutdown
│   ├── config.ts              # PORT_DEFAULT, SHUTDOWN_TIMEOUT_MS
│   └── swagger.ts             # сборка OpenAPI-спеки из аннотаций в routes.ts
│
├── pages/                     # точка входа: роутер + обработчики
│   ├── items/
│   │   ├── routes.ts          # express Router для /api/items + swagger-аннотации
│   │   ├── handlers.ts        # getItems, getItemById, createItem, changeItem
│   │   ├── events.ts          # SSE /api/items/events: flushed, stats
│   │   └── utils.ts           # ItemError, sendError, чтение Idempotency-Key
│   └── health/
│       ├── routes.ts          # GET /health
│       └── handlers.ts
│
├── entities/                  # домен элементов
│   └── items/
│       ├── model.ts           # ItemModel
│       ├── dto.ts             # DTO и типы ответов
│       ├── store.ts           # itemsMap, pendingIds, initItemsStore
│       ├── createLane.ts      # линия создания: applyCreates, ответ 202 не ждёт
│       ├── changeLane.ts      # линия изменений: applyChanges, клиент ждёт
│       └── readLane.ts        # линия чтений: общий снапшот, сборка страницы
│
└── shared/                    # общее, без знаний о домене
    ├── config/                # константы: admission, batch, dedup,
    │                          # pagination, request, items, events
    ├── lib/
    │   └── queue/             # generic-механизмы: batchLane.ts, dedup.ts
    ├── services/              # инфраструктура процесса: logger.ts, lifecycle.ts
    ├── middleware/            # admission, error, requestLogger
    ├── types/                 # health, error, pagination
    └── utils/                 # mapping.utils, request.utils
```

## Правило слоёв

Стрелка импорта всегда смотрит **вниз**:

```
app  →  pages  →  entities  →  shared
```

- `shared` не импортирует `entities`, `pages` и `app` — иначе общее перестаёт быть общим;
- `pages` и `entities` не импортируют `app` — константы, нужные им снизу, живут в `shared/config`;
- `app` импортирует всё: он единственный, кто знает о существовании остальных слоёв.

Приём: **механизм без доменного знания** (например `BatchLane`) живёт в
`shared/lib`, а всё, что связывает его с доменом (`createLane`, `applyCreates`,
`itemsMap`) — в `entities`.

## Запуск

```bash
npm run dev      # разработка: tsx --watch, читает .env.development
npm run build    # tsc → dist/
npm start        # node dist/app/index.js
npm run pretty   # prettier --write
npm run lint     # eslint .
npm run lint:fix # eslint . --fix
```

## Переменные окружения

Берутся из `.env.development` (при `npm run dev`) или из окружения:

| Переменная | Назначение |
|---|---|
| `PORT` | порт http-сервера, по умолчанию `3000` |
| `LOG_LEVEL` | уровень логов pino (`info`, `warn`, ...) |
| `LOG_FILE` | файл для логов, например `logs/app.log`; пусто — только stdout |
| `LOG_SIZE` | максимальный размер файла (`10m`, `1g`, `500k`) |
| `LOG_FREQUENCY` | ротация: `daily`, `hourly` |

## Swagger

- UI: <http://localhost:3000/api-docs>
- Спека: <http://localhost:3000/api-docs/swagger.json>

Аннотации лежат в `src/pages/**/routes.ts` и подхватываются `swagger-jsdoc`
при старте — отдельно спеку руками не дописывают.

## Проверки перед коммитом

```bash
npx tsc --noEmit
npm run lint
npx prettier --check "src/**/*.ts"
```

Тестов в проекте пока нет.

## Инструменты

- **ESLint** (`eslint.config.mjs`): `@eslint/js` + `typescript-eslint` + `eslint-config-prettier`
  (последний гасит правила, конфликтующие с Prettier).
- **TypeScript 7 + 6 параллельно**: `tsc` — нативный TS 7.0 (пакет `@typescript/native`),
  а `require('typescript')` резолвится в TS 6 API (пакет `typescript` =
  `npm:@typescript/typescript6`), потому что TS 7.0 ещё не имеет JS API,
  а typescript-eslint работает через него. Подробности:
  <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0>
- **`.npmrc`** содержит `legacy-peer-deps=true` — peer-диапазоны `typescript-eslint`
  пока не знают про эти алиасы, обычный `npm install` на них падает.
