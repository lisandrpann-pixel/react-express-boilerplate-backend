import { Request, Response, Router } from 'express'

import { createLane } from '../../entities/items/createLane'
import {
  SSE_HEARTBEAT_MS,
  SSE_MAX_CLIENTS,
  SSE_RETRY_MS,
} from '../../shared/config/events.config'
import { isShuttingDown } from '../../shared/services/lifecycle'
import { logger } from '../../shared/services/logger'
import { ResponseError } from '../../shared/types/error.types'

/**
 * Подписчики потока.
 *
 * Один реестр на процесс. Слот admission-счётчика не занимается — роутер
 * смонтирован до admission, — поэтому ограничиваем число клиентов здесь,
 * своим лимитом.
 */
const clients = new Set<Response>()

const send = (client: Response, event: string, data: unknown): void => {
  if (client.writableEnded || client.destroyed) return

  try {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  } catch (error) {
    /**
     * Сокет мог умереть между проверкой и записью. Это не ошибка сервера:
     * клиент отвалится, и его почистит обработчик close ниже
     */
    logger.debug({ err: error }, 'Не удалось записать событие в поток')
  }
}

const broadcast = (event: string, data: unknown): void => {
  for (const client of clients) {
    send(client, event, data)
  }
}

const refuse = (res: Response, error: string): void => {
  const body: ResponseError = { error }

  res.set('Retry-After', String(Math.ceil(SSE_RETRY_MS / 1000)))
  res.status(503).json(body)
}

/**
 * Один слушатель на процесс: очередь — generic-механизм, а что означает
 * «элемент применился», знает только домен. Подписка на уровне модуля:
 * роутер импортируется один раз при старте, отписываться некому.
 */
createLane.onFlush((batch) => {
  broadcast('flushed', {
    ids: batch.map((item) => item.id),
    count: batch.length,
    at: new Date().toISOString(),
  })
})

export const itemsEventsRouter = Router()

/**
 * @swagger
 * /api/items/events:
 *   get:
 *     summary: Поток событий разгрузки батчей
 *     description: >
 *       Server-Sent Events. Клиенту, получившему 202 на POST /api/items,
 *       больше не нужно опрашивать GET: сервер сам сообщает, когда очередь
 *       разгрузилась и элемент стал виден. Событие приходит не позже, чем
 *       через интервал разгрузки (10 секунд).
 *
 *       Поток монтируется отдельно от остальных маршрутов и не занимает
 *       слот лимита одновременных обработчиков, но имеет собственный лимит
 *       подписчиков: при превышении — 503 с Retry-After.
 *
 *       Реплея нет: события, пропущенные во время обрыва соединения,
 *       не восстанавливаются. После переподключения клиент сверяет
 *       состояние через hello и GET /api/items.
 *     tags:
 *       - Items
 *     responses:
 *       '200':
 *         description: Поток открыт
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: >
 *                 Поток событий. Поле retry задаёт паузу перед
 *                 переподключением, комментарии `: ping` — heartbeat.
 *               example: |
 *                 retry: 3000
 *
 *                 event: hello
 *                 data: {"queued":0,"pushedTotal":12,"flushedTotal":12,"lastFlushedAt":1791295175403,"clients":1}
 *
 *                 event: flushed
 *                 data: {"ids":[1000100],"count":1,"at":"2026-10-06T18:00:00.000Z"}
 *       '503':
 *         description: >
 *           Сервер останавливается либо превышен лимит подписчиков потока.
 *           Повторите попытку позже
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     - 'Сервер останавливается'
 *                     - 'Слишком много подписчиков потока, повторите позже'
 */
itemsEventsRouter.get('/items/events', (req: Request, res: Response) => {
  /**
   * Поток смонтирован до admission, а значит его обходит проверка
   * isShuttingDown там. Говорим «сервер останавливается» здесь сами —
   * иначе новый клиент успеет подключиться между beginShutdown и close()
   * и упрёт остановку в таймаут принудительного закрытия соединений
   */
  if (isShuttingDown()) {
    refuse(res, 'Сервер останавливается')

    return
  }

  if (clients.size >= SSE_MAX_CLIENTS) {
    refuse(res, 'Слишком много подписчиков потока, повторите позже')

    return
  }

  res.status(200)
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  res.write(`retry: ${SSE_RETRY_MS}\n\n`)

  clients.add(res)

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n')
  }, SSE_HEARTBEAT_MS)

  heartbeat.unref()

  let closed = false

  const close = (): void => {
    if (closed) return

    closed = true

    clearInterval(heartbeat)
    clients.delete(res)
  }

  res.once('close', close)
  res.once('error', close)

  send(res, 'stats', { ...createLane.stats(), clients: clients.size })

  logger.debug(
    { reqId: req.id, clients: clients.size },
    'Клиент подключился к потоку событий'
  )
})

/**
 * Гасим потоки при остановке — до вызова server.close().
 *
 * Открытый поток это активное соединение: close() ждал бы его естественного
 * конца и упёрся бы в таймаут принудительного закрытия. Событие shutdown
 * отдаём заранее, чтобы клиент узнал об остановке, а не принял её за обрыв
 * и не начал переподключаться вхолостую.
 */
export const closeItemsEvents = (): void => {
  for (const client of clients) {
    send(client, 'shutdown', { reason: 'Сервер останавливается' })

    client.end()
  }

  clients.clear()

  logger.debug('Потоки событий закрыты')
}
