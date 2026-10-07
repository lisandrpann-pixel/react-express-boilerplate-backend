import { ItemModel } from './model'
import {
  SYNC_BATCH_CAPACITY,
  SYNC_BATCH_INTERVAL_MS,
  SYNC_BATCH_MAX,
} from '../../shared/config/batch.config'
import { itemsMap } from './store'
import { BatchLane } from '../../shared/lib/queue/batchLane'

/**
 * Применяем пачку изменений. Сейчас это запись в память, позже — один
 * batched UPDATE.
 *
 * Как и с созданием, apply — единственное место, где понадобится транзакция.
 * Ответ клиенту при этом не готовится здесь: обработчик уже знает будущий
 * элемент и просто ждёт, пока пачка применится.
 */
const applyChanges = async (batch: ItemModel[]): Promise<void> => {
  for (const item of batch) {
    itemsMap.set(item.id, item)
  }
}

export const changeLane = new BatchLane<ItemModel>({
  name: 'изменение',
  intervalMs: SYNC_BATCH_INTERVAL_MS,
  maxBatch: SYNC_BATCH_MAX,
  capacity: SYNC_BATCH_CAPACITY,
  apply: applyChanges,
})
