# Структура проекта

```
src/
├── app/
│   ├── index.ts              # точка входа
│   └── config.ts             # настройки (порт, env, CORS и т.п.)
├── pages/                    # роуты (контроллеры)
│   ├── items/
│   │   ├── routes.ts         # express Router для /api/items
│   │   └── handlers.ts       # обработчики (getItems и т.д.)
├── features/
│   └── filters/
│       ├── index.ts
│       └── filters.ts        # сценарий фильтрации
├── entities/
│   └── item/
│       ├── model.ts          # ORM-модель (TypeORM/Prisma/Mongoose)
│       ├── dto.ts            # DTO для заказа
│       └── utils.ts          # валидация, форматирование
└── shared/
    ├── utils/
    │   ├── logger.ts
    │   └── helpers.ts
    ├── types/
    │   └── common.ts
    └── middleware/
        ├── auth.ts
        └── validation.ts
```
