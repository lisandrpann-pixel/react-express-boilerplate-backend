import { ErrorRequestHandler, RequestHandler } from 'express'

import { logger } from '../logger/logger'
import { ResponseError } from '../types/error.types'


/**
 * Ошибки express.json()
 */
const PARSER_ERRORS: Record<string, {
  status: number
  message: string
}> = {
  'entity.parse.failed': {
    status: 400,
    message: 'Тело запроса не является корректным JSON',
  },
  'entity.too.large': {
    status: 413,
    message: 'Тело запроса превышает допустимый размер',
  },
}

const WHITE_LIST_STATUS_ERRORS: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Требуется авторизация',
  403: 'Доступ запрещён',
  404: 'Не найдено',
  405: 'Метод не поддерживается',
  409: 'Конфликт состояния',
  413: 'Тело запроса слишком большое',
  415: 'Неподдерживаемый тип содержимого',
  429: 'Слишком много запросов',
}

const DEFAULT_ERROR: string = 'Внутренняя ошибка сервера'

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ResponseError = {
    error: `Маршрут ${req.method} ${req.originalUrl} не найден`,
  }

  res.status(404).json(body)
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error)

    return
  }

  const parserError =
    typeof error?.type === 'string' ? PARSER_ERRORS[error.type] : undefined

  if (parserError !== undefined) {
    const body: ResponseError = { error: parserError.message }

    res.status(parserError.status).json(body)

    return
  }

  const status = typeof error?.status === 'number' ? error.status : 500
  const whiteListError = WHITE_LIST_STATUS_ERRORS[status]

  if (whiteListError !== undefined) {
    const body: ResponseError = { error: whiteListError }

    res.status(status).json(body)

    return
  }

  logger.error(
    {
      err: error,
      reqId: req.id,
      method: req.method,
      path: req.path,
    },
    DEFAULT_ERROR
  )

  const body: ResponseError = { error: DEFAULT_ERROR }

  res.status(500).json(body)
}
