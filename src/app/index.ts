import express from 'express'
import { Server } from 'node:http'
import swaggerUi from 'swagger-ui-express'

import healthRouter from '../pages/health/routes'
import {
  initItemsStore,
} from '../pages/items/handlers'
import itemsRouter from '../pages/items/routes'
import swaggerSpec from '../swagger'
import { admission } from '../shared/middleware/admission.middleware'
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
import { PORT_DEFAULT, SHUTDOWN_TIMEOUT_MS } from './config'
import { createLane } from '../shared/queue'

const app = express()

const PORT = process.env.PORT || PORT_DEFAULT

app.use(requestLogger)

app.use(exposeRequestId)

app.use(healthRouter)

app.use(admission)

app.use(express.json())

app.get('/api-docs/swagger.json', (_req, res) => res.json(swaggerSpec))

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/api', itemsRouter)

app.use(notFoundHandler)

app.use(errorHandler)

const itemsCount = initItemsStore()

createLane.start()

const server: Server = app.listen(PORT)

server.on('error', (error) => {
  logger.fatal(
    { err: error, port: PORT },
    'Не удалось занять порт, сервер не запущен'
  )

  exitWith(1)
})

server.once('listening', () => {
  logger.info(
    {
      port: PORT,
      swagger: `http://localhost:${PORT}/api-docs`,
      items: itemsCount,
    },
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
   * Порт мог не заняться: если bind упал, закрывать нечего, и close()
   * бросил бы ERR_SERVER_NOT_RUNNING поверх исходной ошибки
   */
  if (!server.listening) {
    logger.info('Сервер не слушал порт, сбрасываю логи')

    flushLogsAndExit(exitCode)

    return
  }

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

    logger.info('Соединения закрыты, разгружаю очередь создания')

    /**
     * Досылаем то, что уже приняли от клиентов. Порядок важен: соединения уже
     * закрыты, новые POST не придут и не смогут наполнить буфер заново во
     * время разгрузки.
     *
     * Ожидание сознательное: клиент получил 202, и элемент обязан появиться
     * раньше, чем процесс уйдёт. На случай зависшей разгрузки работает
     * exitTimer выше — он выстрелит по SHUTDOWN_TIMEOUT_MS.
     */
    void (async (): Promise<void> => {
      try {
        await createLane.stop()

        logger.info('Очередь создания разгружена, сбрасываю логи')
      } catch (error) {
        logger.error({ err: error }, 'Не удалось разгрузить очередь создания')
      }

      flushLogsAndExit(exitCode)
    })()
  })

  /**
   * keep-alive соединения держат close() открытыми. idle можно закрыть сразу,
   * активные клиенты получат ответ и освободят соединение сами
   */
  server.closeIdleConnections()
}

/**
 * Сброс буфера логов перед выходом. При transport записи идут через worker
 * и sonic-boom, поэтому без flush хвост логов, включая запись о самой
 * остановке, просто потеряется. Обёртка в try/catch нужна на случай, если
 * flush бросит синхронно: зависнуть здесь нельзя, процесс обязан выйти
 */
const flushLogsAndExit = (exitCode: number): void => {
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
