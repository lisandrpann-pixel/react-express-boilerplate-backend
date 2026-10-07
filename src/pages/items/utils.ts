import { BatchLaneFullError } from '../../shared/lib/queue/batchLane'
import { logger } from '../../shared/services/logger'
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY_MAX_LENGTH,
} from '../../shared/config/dedup.config'
import { IdempotencyConflictError } from '../../shared/lib/queue/dedup'
import { Request, Response } from 'express'

export const readIdempotencyKey = (req: Request): string | undefined => {
  const header = req.get(IDEMPOTENCY_HEADER)

  if (header === undefined) return undefined

  const key = header.trim()

  if (key.length === 0 || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new ItemError(
      400,
      `Некорректный ${IDEMPOTENCY_HEADER}: ожидается непустая строка длиной до ${IDEMPOTENCY_KEY_MAX_LENGTH} символов`
    )
  }

  return key
}

/**
 * Ошибка, которую нужно отдать клиенту как есть. Проверка «уже существует» или
 * «не найден» живёт внутри дедупликации, то есть после await, поэтому вернуть
 * ответ напрямую оттуда нельзя — приходится бросать и разворачивать в catch.
 */
export class ItemError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)

    this.name = 'ItemError'
    this.status = status
  }
}

export const sendError = (res: Response, error: unknown): void => {
  /**
   * Буфер не успевает разгружаться. В access-лог этот ответ не попадёт —
   * requestLogger молчит про 503 с Retry-After, потому что при неисправном
   * admission их шли сотни в секунду. Здесь случай единичный и означает, что
   * разгрузка встала, поэтому пишем его сами.
   */
  if (error instanceof BatchLaneFullError) {
    logger.error(
      { err: error, lane: error.lane, capacity: error.capacity },
      'Очередь переполнена, запрос отклонён'
    )

    res.set('Retry-After', String(error.retryAfterSeconds))
    res.status(503).json({ error: error.message })
    return
  }

  if (error instanceof IdempotencyConflictError) {
    res.status(409).json({ error: error.message })
    return
  }

  if (error instanceof ItemError) {
    res.status(error.status).json({ error: error.message })
    return
  }

  /**
   * Неизвестная ошибка: отдавать её текст клиенту нельзя. Пусть дойдёт до
   * errorHandler, который превратит её в 500 без деталей.
   */
  throw error
}
