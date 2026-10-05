import pino from 'pino'

/**
 * Уровень задаётся переменной окружения: debug, info, warn, error, silent
 */
const level: string = process.env.LOG_LEVEL ?? 'info'

export const logger = pino({
  level,
  base: { service: 'digital-solutions-backend' },
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
})
