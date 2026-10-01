import { Router, Request, Response } from 'express'
import rawUsers from './data.json'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../shared/configs/pagination.config'
import { parseNonNegativeInt } from '../../shared/utils/mapping.utils'
import { PaginationQuery } from '../../shared/types/pagination.types'
import { UserModel } from '../../entities/users/model'
import { UserDto, UsersDto } from '../../entities/users/dto'
import { ResponseError } from '../../shared/types/error.types'

const users = rawUsers as UserModel[]

const usersById = new Map(users.map((user) => [user._id, user]))

export const getUsers = (
  req: Request<Record<string, string>, unknown, unknown, PaginationQuery>,
  res: Response<UsersDto | ResponseError>
) => {
  const offset = parseNonNegativeInt(req.query.offset, 0)
  const limit = parseNonNegativeInt(req.query.limit, DEFAULT_LIMIT)

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
  const data = users.slice(offset, offset + pageSize)

  res.json({
    data,
    pagination: {
      offset,
      limit: pageSize,
      total: users.length,
      hasMore: offset + data.length < users.length,
    },
  })
}

export const getUserById = (
  req: Request<{ id: string }>,
  res: Response<UserDto | ResponseError>
) => {
  const userId = req.params.id

  const user = usersById.get(userId)

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json(user)
}
