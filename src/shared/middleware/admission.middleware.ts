import { Request, RequestHandler, Response } from 'express'

import {
  ADMISSION_LOG_INTERVAL_MS,
  ADMISSION_MAX_IN_FLIGHT,
  ADMISSION_RETRY_AFTER_SECONDS,
} from '../config/admission.config'
import { logger } from '../services/logger'
import { isShuttingDown } from '../services/lifecycle'
import { ResponseError } from '../types/error.types'

/**
 * Число запросов, которые уже дошли до обработчиков и ещё не ответили.
 *
 * Счётчик живёт в модуле, поэтому один на процесс: общей памяти у него нет,
 * и при нескольких инстансах сервера реальная ёмкость складывается из них всех.
 */
let inFlight = 0

/** Отклонено за всё время работы процесса */
let rejected = 0

/** Пик одновременных незавершённых запросов — нужен для /health и разборов */
let peak = 0

let lastLogAt = 0

export const admissionStats = (): {
  inFlight: number
  limit: number
  peak: number
  rejected: number
} => ({
  inFlight,
  limit: ADMISSION_MAX_IN_FLIGHT,
  peak,
  rejected,
})

/**
 * Отказ с 503 и Retry-After.
 *
 * Заголовок Retry-After ставится всегда, в том числе при остановке сервера, хотя
 * повторять тогда и не во что: наш access-лог ориентируется на него, чтобы
 * отличить перегрузку от любого другого 503 (например, /health при shutdown).
 */
const refuse = (req: Request, res: Response, error: string): void => {
  rejected += 1

  const now = Date.now()

  if (now - lastLogAt >= ADMISSION_LOG_INTERVAL_MS) {
    lastLogAt = now

    logger.warn(
      {
        reqId: req.id,
        reason: error,
        inFlight,
        limit: ADMISSION_MAX_IN_FLIGHT,
        rejected,
        peak,
      },
      'Отклонён запрос, исчерпан лимит обработчиков'
    )
  }

  const body: ResponseError = { error }

  res.set('Retry-After', String(ADMISSION_RETRY_AFTER_SECONDS))
  res.status(503).json(body)
}

/**
 * Глобальная ёмкость обработчиков: при переполнении отдаём 503 с Retry-After.
 *
 * Ставится до express.json(), чтобы отклонённый запрос не разбирался как JSON:
 * тело всё равно не нужно, а парсинг под флудом стоит дороже самого ответа.
 *
 * Гасить счётчик приходится на двух событиях. finish срабатывает, когда мы
 * сами отправили ответ, close — когда клиент оборвал соединение или началась
 * остановка сервера. Слушается только одно из них, и слот клиента занимался
 * бы до самого перезапуска процесса.
 */
export const admission: RequestHandler = (req, res, next) => {
  if (isShuttingDown()) {
    /**
     * Между beginShutdown и close() ещё приходят запросы на живых
     * keep-alive соединениях. Обслуживать их уже нельзя, а держать соединение
     * ради 503 бессмысленно, поэтому рвём его.
     */
    res.set('Connection', 'close')
    refuse(req, res, 'Сервер останавливается')

    return
  }

  if (inFlight >= ADMISSION_MAX_IN_FLIGHT) {
    refuse(req, res, 'Сервер перегружен, повторите запрос позже')

    return
  }

  inFlight += 1
  peak = Math.max(peak, inFlight)

  let released = false

  const release = (): void => {
    if (released) return

    released = true
    inFlight -= 1
  }

  res.once('finish', release)
  res.once('close', release)

  next()
}
