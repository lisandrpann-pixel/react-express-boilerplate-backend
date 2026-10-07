import { ItemModel } from './model'
import { ItemsDto } from './dto'
import {
  SYNC_BATCH_CAPACITY,
  SYNC_BATCH_INTERVAL_MS,
  SYNC_BATCH_MAX,
} from '../../shared/config/batch.config'
import { itemsMap } from './store'
import { BatchLane } from '../../shared/lib/queue/batchLane'
import { matchesIdFilter } from '../../shared/utils/mapping.utils'
import { IdRange } from '../../shared/types/pagination.types'

/**
 * Параметры одного чтения.
 *
 * Обработчик собирает их до постановки в очередь: валидация остаётся
 * синхронной, поэтому 400 уходят сразу и не дожидаются разгрузки.
 */
export type ReadQuery = {
  offset: number
  limit: number
  idRanges: IdRange[]
  itemIdFilter: string | undefined
  hasChosenFilter: boolean
  wantChosen: boolean
}

export type ReadTask = {
  query: ReadQuery
  /**
   * Отдаёт клиенту страницу.
   *
   * Результат чтения — доменные данные, поэтому он возвращается колбэком из
   * apply, а не промисом очереди: очередь не умеет собирать разные ответы
   * для разных элементов одной пачки.
   */
  done: (page: ItemsDto) => void
}

const buildPage = (snapshot: ItemModel[], query: ReadQuery): ItemsDto => {
  let itemsFiltered = snapshot

  if (query.idRanges.length) {
    itemsFiltered = itemsFiltered.filter((item) =>
      matchesIdFilter(query.idRanges, item.id)
    )
  }

  if (query.hasChosenFilter) {
    itemsFiltered = itemsFiltered.filter(
      (item) => item.isChosen === query.wantChosen
    )
  }

  const data = itemsFiltered.slice(query.offset, query.offset + query.limit)

  return {
    data,
    pagination: {
      offset: query.offset,
      limit: query.limit,
      total: itemsFiltered.length,
      hasMore: query.offset + data.length < itemsFiltered.length,
      ...(query.itemIdFilter ? { itemIdFilter: query.itemIdFilter } : {}),
      ...(query.hasChosenFilter ? { isChosenFilter: query.wantChosen } : {}),
    },
  }
}

/**
 * Применяем пачку чтений.
 *
 * Сейчас общий снапшот — это копия Map: один раз на пачку вместо копии на
 * каждый запрос, а все чтения пачки гарантированно видят одно состояние.
 * Позже снапшот станет одним SELECT на всю пачку, а фильтрация с пагинацией
 * останется локальной — в этом и смысл батчинга чтений.
 *
 * Отказывает только загрузка снапшота, и она стоит до цикла: если apply упал,
 * ни один done не вызван, пачка целиком уходит в повтор, и клиентские промисы
 * продолжают ждать.
 */
const applyReads = async (batch: ReadTask[]): Promise<void> => {
  const snapshot = Array.from(itemsMap.values())

  for (const task of batch) {
    task.done(buildPage(snapshot, task.query))
  }
}

export const readLane = new BatchLane<ReadTask>({
  name: 'чтение',
  intervalMs: SYNC_BATCH_INTERVAL_MS,
  maxBatch: SYNC_BATCH_MAX,
  capacity: SYNC_BATCH_CAPACITY,
  apply: applyReads,
})
