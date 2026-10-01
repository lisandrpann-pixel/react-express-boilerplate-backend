# Структура проекта

```
src/
├── app/
│   ├── index.ts              # точка входа
│   └── config.ts             # настройки (порт, env, CORS и т.п.)
├── pages/                    # роуты (контроллеры)
│   ├── users/
│   │   ├── routes.ts         # express Router для /api/users
│   │   └── handlers.ts       # обработчики (getUsers и т.д.)
├── features/
│   └── filters/
│       ├── index.ts
│       └── filters.ts        # сценарий фильтрации
├── entities/
│   └── user/
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
