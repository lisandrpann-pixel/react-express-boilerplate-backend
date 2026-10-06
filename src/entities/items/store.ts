import { ItemModel } from './model'
import { TOTAL_ITEMS } from '../../shared/config/items.config'

export const itemsMap = new Map<number, ItemModel>()

/**
 * Id, уже попавшие в буфер, но ещё не применённые
 */
export const pendingIds = new Set<number>()

export const initItemsStore = (): number => {
  if (itemsMap.size > 0) return itemsMap.size

  for (let id = 1; id <= TOTAL_ITEMS; id += 1) {
    itemsMap.set(id, { id, order: id, isChosen: false })
  }

  return itemsMap.size
}
