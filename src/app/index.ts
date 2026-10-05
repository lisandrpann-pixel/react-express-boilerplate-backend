import express from 'express'
import { Server } from 'node:http'
import swaggerUi from 'swagger-ui-express'

import healthRouter from '../pages/health/routes'
import itemsRouter from '../pages/items/routes'
import swaggerSpec from '../swagger'
import {
  errorHandler,
  notFoundHandler,
} from '../shared/middleware/error.middleware'
import {
  exposeRequestId,
  requestLogger,
} from '../shared/middleware/requestLogger.middleware'
import { logger } from '../shared/logger/logger'
import { beginShutdown } from '../shared/state/lifecycle'
import { LIMITTER, PORT_DEFAULT, SHUTDOWN_TIMEOUT_MS } from './config'

const app = express()

const PORT = process.env.PORT || PORT_DEFAULT

app.use(requestLogger)

app.use(exposeRequestId)

app.use(healthRouter)

app.use(express.json())

app.use(LIMITTER)

app.get('/api-docs/swagger.json', (_req, res) => res.json(swaggerSpec))

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/api', itemsRouter)

app.use(notFoundHandler)

app.use(errorHandler)

const server: Server = app.listen(PORT, () => {
  logger.info(
    { port: PORT, swagger: `http://localhost:${PORT}/api-docs` },
    'Сервер запущен'
  )
})

let isShuttingDown = false
let exitTimer: NodeJS.Timeout | undefined

/**
 * Перестаём принимать соединения, закрываем keep-alive, сбрасываем логи,
 * и только после этого выходим.
 *
 * server.close() сам по себе не гарантирует выход — keep-alive соединения
 * держат его открытыми, поэтому есть таймаут и принудительное закрытие.
 * Без logger.flush() хвост записей из буфера pino-roll потеряется.
 */
const shutdown = (signal: string, exitCode: number): void => {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Повторный сигнал, ускоряю остановку')

    server.closeAllConnections()
    exitWith(exitCode === 0 ? 1 : exitCode)

    return
  }

  isShuttingDown = true
  beginShutdown()

  logger.info({ signal }, 'Получен сигнал остановки')

  /**
   * Страховка: если flush не вызовет колбэк, процесс обязан выйти,
   * иначе контейнер будет убит по таймауту kill
   */
  exitTimer = setTimeout(() => {
    logger.warn(
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
      'Логи не сбросились за отведённое время, выхожу принудительно'
    )

    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)

  const forceTimer = setTimeout(() => {
    logger.warn(
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
      'Соединения не закрылись за отведённое время, закрываю принудительно'
    )

    server.closeAllConnections()
  }, SHUTDOWN_TIMEOUT_MS)

  forceTimer.unref()

  server.close((closeError) => {
    clearTimeout(forceTimer)

    if (closeError !== undefined) {
      logger.error({ err: closeError }, 'Ошибка при закрытии сервера')
      exitWith(1)

      return
    }

    logger.info('Соединения закрыты, сбрасываю логи')

    try {
      logger.flush((flushError) => {
        if (flushError !== undefined) {
          logger.error({ err: flushError }, 'Не удалось сбросить логи')
        }

        exitWith(exitCode)
      })
    } catch (error) {
      logger.error({ err: error }, 'Исключение при сбросе логов')

      exitWith(exitCode)
    }
  })

  /**
   * keep-alive соединения держат close() открытыми. idle можно закрыть сразу,
   * активные клиенты получат ответ и освободят соединение сами
   */
  server.closeIdleConnections()
}

const exitWith = (code: number): void => {
  if (exitTimer !== undefined) {
    clearTimeout(exitTimer)
    exitTimer = undefined
  }

  process.exit(code)
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM', 0)
})

process.on('SIGINT', () => {
  shutdown('SIGINT', 0)
})

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Необработанное исключение, останавливаюсь')

  shutdown('uncaughtException', 1)
})

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Необработанный отказ промиса, останавливаюсь')

  shutdown('unhandledRejection', 1)
})
