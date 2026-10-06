import { ItemModel } from "../../entities/items/model"
import { CREATE_BATCH_CAPACITY, CREATE_BATCH_INTERVAL_MS, CREATE_BATCH_MAX } from "../configs/batch.config"
import { itemsMap, pendingIds } from "../state"
import { BatchLane } from "./batchLane"

/**
 * Применяем пачку. Сейчас это запись в память, позже — один batched INSERT.
 *
 * Точка расширения: сюда уйдёт запрос к БД, и все 500 элементов поедут одной
 * командой вместо 500 отдельных. Тогда apply станет единственный местом, где
 * нужны транзакция и её ошибки — логика наверху не изменится.
 */
const applyCreates = async (batch: ItemModel[]): Promise<void> => {
  for (const item of batch) {
    itemsMap.set(item.id, item)

    pendingIds.delete(item.id)
  }
}

export const createLane = new BatchLane<ItemModel>({
  name: 'создание',
  intervalMs: CREATE_BATCH_INTERVAL_MS,
  maxBatch: CREATE_BATCH_MAX,
  capacity: CREATE_BATCH_CAPACITY,
  apply: applyCreates,
})