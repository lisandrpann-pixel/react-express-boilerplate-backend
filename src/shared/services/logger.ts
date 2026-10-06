import pino from 'pino'

const level: string = process.env.LOG_LEVEL ?? 'info'

/**
 * Пусто или не задано — пишем только в stdout. Это правильный режим для
 * docker: логи забирает окружение, ротацией занимается оно же.
 * Как только задан LOG_FILE, добавляется ещё и файл с ротацией.
 * Проверка через trim || undefined, потому что в .env пустая строка
 * даёт '' , а не undefined, и pino-roll на пустом пути падает
 */
const logFile: string | undefined = process.env.LOG_FILE?.trim() || undefined

const common = {
  level,
  base: { service: 'digital-solutions-backend' },
  /**
   * pino-http сериализует req целиком, вместе с заголовками,
   * поэтому авторизация и куки маскируются явно
   */
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
    ],
    censor: '[скрыто]',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
}

export const logger =
  logFile === undefined
    ? pino(common)
    : pino({
        ...common,
        transport: {
          targets: [
            /** stdout остаётся, чтобы dev и docker logs не теряли вывод */
            { level, target: 'pino/file', options: { destination: 1 } },
            {
              level,
              target: 'pino-roll',
              options: {
                file: logFile,
                mkdir: true,
                size: process.env.LOG_SIZE ?? '10m',
                frequency: process.env.LOG_FREQUENCY ?? 'daily',
                /**
                 * Без dateFormat pino-roll 4 пишет app.1.log и по дате
                 * файл не опознать. С ним выходит app.2026-10-05.1.log
                 */
                dateFormat: 'dd-MM-yyyy',
                /** активный файл + 5 ротированных */
                limit: { count: 5 },
              },
            },
          ],
        },
      })
