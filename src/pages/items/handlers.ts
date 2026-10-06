import { Request, Response } from 'express'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../../shared/config/pagination.config'
import {
  matchesIdFilter,
  parseIdFilter,
  parseNonNegativeInt,
} from '../../shared/utils/mapping.utils'
import { PaginationAndFilterQuery } from '../../shared/types/pagination.types'
import { ItemModel } from '../../entities/items/model'
import {
  ChangeItemDto,
  CreateItemDto,
  ItemDto,
  ItemsDto,
  QueuedItemDto,
} from '../../entities/items/dto'
import { ResponseError } from '../../shared/types/error.types'
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY_MAX_LENGTH,
} from '../../shared/config/dedup.config'
import {
  dedup,
  dedupKey,
  IdempotencyConflictError,
} from '../../shared/lib/queue/dedup'
import { fingerprintOf } from '../../shared/utils/request.utils'
import { CREATE_BATCH_RETRY_AFTER_SECONDS } from '../../shared/config/batch.config'
import { BatchLaneFullError } from '../../shared/lib/queue/batchLane'
import { logger } from '../../shared/services/logger'
import { createLane } from '../../entities/items/createLane'
import { itemsMap, pendingIds } from '../../entities/items/store'

/**
 * Ошибка, которую нужно отдать клиенту как есть. Проверка «уже существует» или
 * «не найден» живёт внутри дедупликации, то есть после await, поэтому вернуть
 * ответ напрямую оттуда нельзя — приходится бросать и разворачивать в catch.
 */
class ItemError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)

    this.name = 'ItemError'
    this.status = status
  }
}

const readIdempotencyKey = (req: Request): string | undefined => {
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

const sendError = (res: Response, error: unknown): void => {
  /**
   * Буфер не успевает разгружаться. В access-лог этот ответ не попадёт —
   * requestLogger молчит про 503 с Retry-After, потому что при неисправном
   * admission их шли сотни в секунду. Здесь случай единичный и означает, что
   * разгрузка встала, поэтому пишем его сами.
   */
  if (error instanceof BatchLaneFullError) {
    logger.error(
      { err: error },
      'Очередь создания переполнена, запрос отклонён'
    )

    res.set('Retry-After', String(CREATE_BATCH_RETRY_AFTER_SECONDS))
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

export const getItems = (
  req: Request<
    Record<string, string>,
    unknown,
    unknown,
    PaginationAndFilterQuery
  >,
  res: Response<ItemsDto | ResponseError>
) => {
  const query = req.query

  const offset = parseNonNegativeInt(query.offset, 0)
  const limit = parseNonNegativeInt(query.limit, DEFAULT_LIMIT)
  const itemIdFilter = query.itemIdFilter
  const hasChosenFilter =
    query.isChosenFilter !== undefined && query.isChosenFilter !== ''
  const wantChosen =
    hasChosenFilter &&
    (query.isChosenFilter === 'true' || query.isChosenFilter === '1')

  if (offset === null) {
    res.status(400).json({
      error: 'Некорректный offset: ожидается целое положительное число',
    })

    return
  }

  if (limit === null) {
    res.status(400).json({
      error: 'Некорректный limit: ожидается целое положительное число',
    })

    return
  }

  const idRanges = parseIdFilter(itemIdFilter)

  if (idRanges === null) {
    res.status(400).json({
      error:
        'Некорректный id: ожидаемый формат - число (1), диапазон (1-12, 42)',
    })

    return
  }

  const pageSize = Math.min(limit, MAX_LIMIT)

  let itemsFiltered = Array.from(itemsMap.values())

  if (idRanges.length) {
    itemsFiltered = itemsFiltered.filter((item) =>
      matchesIdFilter(idRanges, item.id)
    )
  }

  if (hasChosenFilter) {
    itemsFiltered = itemsFiltered.filter((item) => item.isChosen === wantChosen)
  }

  const data = itemsFiltered.slice(offset, offset + pageSize)

  res.json({
    data,
    pagination: {
      offset,
      limit: pageSize,
      total: itemsFiltered.length,
      hasMore: offset + data.length < itemsFiltered.length,
      ...(itemIdFilter ? { itemIdFilter } : {}),
      ...(hasChosenFilter ? { isChosenFilter: wantChosen } : {}),
    },
  })
}

export const getItemById = (
  req: Request<{ id: string }>,
  res: Response<ItemDto | ResponseError>
) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) {
    res
      .status(400)
      .json({ error: 'Некорректный id: ожидается целое положительное число' })

    return
  }

  const item = itemsMap.get(id)

  if (!item) {
    res.status(404).json({ error: 'Id не найден' })

    return
  }

  res.json(item)
}

export const createItem = async (
  req: Request<Record<string, string>, unknown, CreateItemDto>,
  res: Response<QueuedItemDto | ResponseError>
): Promise<void> => {
  const { id } = req.body ?? {}

  if (!Number.isInteger(id) || id < 1) {
    res
      .status(400)
      .json({ error: 'Некорректный id: ожидается целое положительное число' })

    return
  }

  try {
    const header = readIdempotencyKey(req)
    const fingerprint = fingerprintOf(req.body)

    const queued = await dedup(
      dedupKey(header, fingerprint, `${req.method} ${req.path}`),
      fingerprint,
      async () => {
        if (itemsMap.has(id)) {
          throw new ItemError(400, `Элемент с id ${id} уже существует`)
        }

        if (pendingIds.has(id)) {
          throw new ItemError(
            400,
            `Элемент с id ${id} уже создаётся, дождитесь появления`
          )
        }

        const item: ItemModel = { id, order: id, isChosen: false }

        /**
         * push идёт до pendingIds.add: если буфер полон, push бросает, и id так
         * и остаётся свободным. Иначе он застрял бы забронированным навсегда
         * и этот элемент нельзя было бы создать никогда.
         */
        createLane.push(item)

        pendingIds.add(id)

        return { ...item, status: 'queued' as const }
      }
    )

    /**
     * 202, а не 201: элемент ещё не добавлен, он в буфере. Иначе клиент
     * ждал бы разгрузки до 10 секунд в открытом соединении и занимал слот,
     * пока стоит в очереди.
     */
    res.set('Retry-After', String(CREATE_BATCH_RETRY_AFTER_SECONDS))
    res.status(202).json(queued)
  } catch (error) {
    sendError(res, error)
  }
}

export const changeItem = async (
  req: Request<Record<string, string>, unknown, ChangeItemDto>,
  res: Response<ItemDto | ResponseError>
): Promise<void> => {
  const { id, isChosen, order } = req.body ?? {}

  if (!Number.isInteger(id) || id < 1) {
    res
      .status(400)
      .json({ error: 'Некорректный id: ожидается целое положительное число' })

    return
  }

  if (typeof isChosen !== 'boolean' || !Number.isInteger(order)) {
    res.status(400).json({
      error:
        'Некорректные данные: isChosen должен быть boolean, order — целым числом',
    })

    return
  }

  try {
    const header = readIdempotencyKey(req)
    const fingerprint = fingerprintOf(req.body)

    const updated = await dedup(
      dedupKey(header, fingerprint, `${req.method} ${req.path}`),
      fingerprint,
      async () => {
        const item = itemsMap.get(id)

        if (!item) {
          throw new ItemError(404, 'Id не найден')
        }

        const newItem: ItemModel = { id, order, isChosen }

        itemsMap.set(id, newItem)

        return newItem
      }
    )

    res.status(200).json(updated)
  } catch (error) {
    sendError(res, error)
  }
}
