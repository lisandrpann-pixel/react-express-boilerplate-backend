import { RequestHandler } from 'express'
import pinoHttp from 'pino-http'

import { logger } from '../logger/logger'
import { resolveRequestId } from '../utils/request.utils'

/**
 * Логируем не каждый запрос, а только проблемные.
 *
 * genReqId берёт заголовок от gateway, если он валидный uuid: так id,
 * который видел клиент, совпадает с id в логах. Иначе uuid невалиден —
 * генерируем свой.
 */
export const requestLogger: RequestHandler = pinoHttp({
  logger,
  genReqId: resolveRequestId,
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
