import { UserModel } from './model'

export type UsersDto = {
  data: UserDto[]
  pagination: {
    offset: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export type UserDto = UserModel
