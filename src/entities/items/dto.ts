import { ItemModel } from './model'

export type ItemsDto = {
  data: ItemDto[]
  pagination: {
    itemIdFilter?: string
    isChosenFilter?: boolean
    offset: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export type ItemDto = ItemModel

export type CreateItemDto = Pick<ItemDto, 'id'>

/**
 * Ответ на создание, когда элемент ещё не применён, а лежит в буфере.
 *
 * Поля известны сразу: `order = id` и `isChosen` вычисляются до разгрузки.
 * Клиент уже видит будущий результат, ему осталось дождаться его появления в
 * GET, поэтому он получает 202, а не 201.
 */
export type QueuedItemDto = ItemModel & { status: 'queued' }

export type ChangeItemDto = ItemDto
