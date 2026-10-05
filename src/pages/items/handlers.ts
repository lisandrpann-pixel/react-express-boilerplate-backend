import { Request, Response } from 'express'
import MOCK_DATA from './data.json'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../shared/configs/pagination.config'
import {
  matchesIdFilter,
  parseIdFilter,
  parseNonNegativeInt,
} from '../../shared/utils/mapping.utils'
import { PaginationAndFilterQuery } from '../../shared/types/pagination.types'
import { ItemModel } from '../../entities/items/model'
import { ChangeItemDto, CreateItemDto, ItemDto, ItemsDto } from '../../entities/items/dto'
import { ResponseError } from '../../shared/types/error.types'

const itemsMap = new Map((MOCK_DATA as ItemModel[]).map((item) => [item.id, item]))

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
  const hasChosenFilter = query.isChosenFilter !== undefined && query.isChosenFilter !== ''
  const wantChosen = hasChosenFilter && (query.isChosenFilter === 'true' || query.isChosenFilter === '1')

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
    itemsFiltered = itemsFiltered.filter(item => matchesIdFilter(idRanges, item.id))
  }
    
  if (hasChosenFilter) {
    itemsFiltered = itemsFiltered.filter(item => item.isChosen === wantChosen)
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
  res: Response<ItemDto | ResponseError>
): Promise<void> => {
  const { id } = req.body ?? {}

  if (!Number.isInteger(id) || id < 1) {
    res
      .status(400)
      .json({ error: 'Некорректный id: ожидается целое положительное число' })

    return
  }

  if (itemsMap.has(id)) {
    res.status(400).json({ error: `Элемент с id ${id} уже существует` })

    return
  }

  const newItem: ItemModel = { id, order: id, isChosen: false }

  itemsMap.set(id, newItem)

  res.status(201).json(newItem)
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
    res
      .status(400)
      .json({
        error: 'Некорректные данные: isChosen должен быть boolean, order — целым числом',
      })

    return
  }

  const item = itemsMap.get(id)

  if (!item) {
    res.status(404).json({ error: 'Id не найден' })

    return 
  }

  const newItem: ItemModel = { id, order, isChosen }

  itemsMap.set(id, newItem)

  res.status(200).json(newItem)
}
