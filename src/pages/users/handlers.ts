import { Request, Response } from 'express'
import rawUsers from './data.json'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../shared/configs/pagination.config'
import { parseNonNegativeInt } from '../../shared/utils/mapping.utils'
import { PaginationAndFilterQuery } from '../../shared/types/pagination.types'
import { UserModel } from '../../entities/users/model'
import { UserDto, UsersDto } from '../../entities/users/dto'
import { ResponseError } from '../../shared/types/error.types'

const usersRaw = rawUsers as UserModel[]

const usersMap = new Map(usersRaw.map((user) => [user._id, user]))

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
    return res
      .status(400)
      .json({ error: 'Invalid offset: expected a non-negative integer' })
  }

  if (limit === null) {
    return res
      .status(400)
      .json({ error: 'Invalid limit: expected a non-negative integer' })
  }

  const pageSize = Math.min(limit, MAX_LIMIT)

  const usersList = userIdFilter
    ? usersRaw.filter((user) => user._id.includes(userIdFilter))
    : usersRaw

  const data = usersList.slice(offset, offset + pageSize)

  res.json({
    data,
    pagination: {
      offset,
      limit: pageSize,
      total: usersList.length,
      hasMore: offset + data.length < usersList.length,
      ...(userIdFilter ? { userIdFilter } : {})
    },
  })
}

export const getUserById = (
  req: Request<{ id: string }>,
  res: Response<UserDto | ResponseError>
) => {
  const userId = req.params.id

  const user = usersMap.get(userId)

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json(user)
}
