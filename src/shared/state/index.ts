import { ItemModel } from "../../entities/items/model"

export const itemsMap = new Map<number, ItemModel>()

/**
 * Id, уже попавшие в буфер, но ещё не применённые
 */
export const pendingIds = new Set<number>()