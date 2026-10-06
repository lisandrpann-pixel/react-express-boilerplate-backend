# digital-solutions/backend

Express 5 + TypeScript, без ORM и без фреймворка поверх Express.

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
│   │   └── handlers.ts        # getItems, getItemById, createItem, changeItem
│   └── health/
│       ├── routes.ts          # GET /health
│       └── handlers.ts
│
├── entities/                  # домен элементов
│   └── items/
│       ├── model.ts           # ItemModel
│       ├── dto.ts             # DTO и типы ответов
│       ├── store.ts           # itemsMap, pendingIds, initItemsStore
│       └── createLane.ts      # очередь создания: applyCreates + BatchLane
│
└── shared/                    # общее, без знаний о домене
    ├── config/                # константы: admission, batch, dedup,
    │                          # pagination, request, items
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
npx prettier --check "src/**/*.ts"
```

Линтера и тестов в проекте пока нет.
