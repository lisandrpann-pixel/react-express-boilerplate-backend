import path from 'node:path'
import { Request, Response } from 'express'
import rawUsers from './data.json'
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
import { UserModel } from '../../entities/users/model'
import { CreateUserDto, UserDto, UsersDto } from '../../entities/users/dto'
import { ResponseError } from '../../shared/types/error.types'

const usersRaw = rawUsers as UserModel[]

const usersMap = new Map(usersRaw.map((user) => [user.id, user]))

export const getUsers = (
  req: Request<
    Record<string, string>,
    unknown,
    unknown,
    PaginationAndFilterQuery
  >,
  res: Response<UsersDto | ResponseError>
) => {
  const offset = parseNonNegativeInt(req.query.offset, 0)
  const limit = parseNonNegativeInt(req.query.limit, DEFAULT_LIMIT)
  const userIdFilter = req.query.userIdFilter

  if (offset === null) {
    return res.status(400).json({
      error: 'Некорректный offset: ожидается целое положительное число',
    })
  }

  if (limit === null) {
    return res.status(400).json({
      error: 'Некорректный limit: ожидается целое положительное число',
    })
  }

  const idRanges = parseIdFilter(userIdFilter)

  if (idRanges === null) {
    return res.status(400).json({
      error:
        'Некорректный id: ожидаемый формат - число (1), диапазон (1-12, 42)',
    })
  }

  const pageSize = Math.min(limit, MAX_LIMIT)

  const usersList = idRanges.length
    ? usersRaw.filter((user) => matchesIdFilter(idRanges, user.id))
    : usersRaw

  const data = usersList.slice(offset, offset + pageSize)

  res.json({
    data,
    pagination: {
      offset,
      limit: pageSize,
      total: usersList.length,
      hasMore: offset + data.length < usersList.length,
      ...(userIdFilter ? { userIdFilter } : {}),
    },
  })
}

export const getUserById = (
  req: Request<{ id: string }>,
  res: Response<UserDto | ResponseError>
) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) {
    return res
      .status(400)
      .json({ error: 'Некорректный id: ожидается целое положительное число' })
  }

  const user = usersMap.get(id)

  if (!user) {
    return res.status(404).json({ error: 'Id не найден' })
  }

  res.json(user)
}

export const createUser = async (
  req: Request<Record<string, string>, unknown, CreateUserDto>,
  res: Response<UserDto | ResponseError>
): Promise<void> => {
  const { id } = req.body ?? {}

  if (!Number.isInteger(id) || id < 1) {
    res
      .status(400)
      .json({ error: 'Некорректный id: ожидается целое положительное число' })

    return
  }

  if (usersMap.has(id)) {
    res.status(400).json({ error: `Пользователь с id ${id} уже существует` })

    return
  }

  const newUser: UserModel = { id }

  usersRaw.push(newUser)
  usersMap.set(id, newUser)

  res.status(201).json(newUser)
}
