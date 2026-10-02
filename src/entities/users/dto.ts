import { UserModel } from './model'

export type UsersDto = {
  data: UserDto[]
  pagination: {
    userIdFilter?: string
    offset: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export type UserDto = UserModel

export type CreateUserDto = Pick<UserModel, 'id'>
