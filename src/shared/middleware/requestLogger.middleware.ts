import { RequestHandler } from 'express'
import pinoHttp from 'pino-http'

import { logger } from '../services/logger'
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
    /**
     * 503 с Retry-After — это сигнал перегрузки от admission. Он уже посчитан
     * и залогирован там с прореживанием, а access-лог под флудом набил бы весь
     * диск. Заголовок Retry-After отличает его от других 503 (например,
     * /health во время остановки), которые логировать нужно
     */
    if (res.statusCode === 503 && res.getHeader('Retry-After') !== undefined) {
      return 'silent'
    }

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
