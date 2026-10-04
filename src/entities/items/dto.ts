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

export type ChangeItemDto = ItemDto
