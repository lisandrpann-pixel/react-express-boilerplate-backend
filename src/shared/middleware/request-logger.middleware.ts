import { randomUUID } from 'node:crypto'

import { RequestHandler } from 'express'
import pinoHttp from 'pino-http'

import { logger } from '../logger/logger'

/**
 * Логируем не каждый запрос, а только проблемные.
 *
 * Важно: autoLogging.ignore здесь использовать нельзя — если он вернёт true,
 * pino-http не подпишется на finish и не запишет ВООБЩЕ НИЧЕГО, включая 5xx.
 * Поэтому фильтр сделан через customLogLevel: у него есть res, и 'silent'
 * гасит только конкретную запись.
 */
export const requestLogger: RequestHandler = pinoHttp({
  logger,
  genReqId: () => randomUUID(),
  customLogLevel: (_req, res, error) => {
    if (error !== undefined || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'

    return 'silent'
  },
})

/** Клиент видит id своего запроса и может прислать его в поддержку */
export const exposeRequestId: RequestHandler = (req, res, next) => {
  res.setHeader('X-Request-Id', String(req.id))

  next()
}
