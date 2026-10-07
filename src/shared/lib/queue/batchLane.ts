import { logger } from '../../services/logger'

export type BatchLaneOptions<T> = {
  /** Название операции — идёт в логи, чтобы понять, какая пачка упала */
  name: string
  /** Период разгрузки буфера */
  intervalMs: number
  /** Максимум элементов в одной операции */
  maxBatch: number
  /** Потолок буфера, дальше — отказ с 503 */
  capacity: number
  /** Что делать с пачкой: сейчас запись в память, позже — batched INSERT */
  apply: (batch: T[]) => Promise<void>
}

/**
 * Буфер переполнен: разгрузка не успевает за входящим потоком.
 */
export class BatchLaneFullError extends Error {
  /** Название линии: в логах и ответе нужно знать, какая именно встала */
  readonly lane: string
  readonly capacity: number
  /** Период разгрузки этой же линии в секундах — его отдаём в Retry-After */
  readonly retryAfterSeconds: number

  constructor(name: string, capacity: number, retryAfterSeconds: number) {
    super(`Очередь «${name}» заполнена, попробуйте позже`)

    this.name = 'BatchLaneFullError'
    this.lane = name
    this.capacity = capacity
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/**
 * Слушатель успешной разгрузки пачки. Очередь не знает, что за элементы
 * в пачке, — домен получает их как есть и сам решает, что с ними делать.
 */
export type BatchLaneFlushListener<T> = (batch: T[]) => void

/**
 * Элемент в буфере вместе с ожиданием из enqueue.
 *
 * flushed пуст у пушей, которые никто не ждёт: там ответ уходит клиенту
 * сразу, а не после разгрузки.
 */
type BufferSlot<T> = {
  item: T
  flushed: (() => void) | undefined
}

export class BatchLane<T> {
  private readonly buffer: BufferSlot<T>[] = []
  private readonly flushListeners: BatchLaneFlushListener<T>[] = []
  private timer: NodeJS.Timeout | undefined
  private draining: Promise<void> | undefined
  private pushedTotal = 0
  private flushedTotal = 0
  private lastFlushedAt: number | undefined

  constructor(private readonly options: BatchLaneOptions<T>) {}

  start = (): void => {
    if (this.timer !== undefined) return

    this.timer = setInterval(() => {
      this.flush()
    }, this.options.intervalMs)

    this.timer.unref()
  }

  /**
   * Подписка на успешную разгрузку пачки: вызывается после того, как apply
   * принял пачку. Возвращает функцию отписки — на случай, если подписчик
   * живёт не всю жизнь процесса.
   */
  onFlush = (listener: BatchLaneFlushListener<T>): (() => void) => {
    this.flushListeners.push(listener)

    return () => {
      const index = this.flushListeners.indexOf(listener)

      if (index !== -1) this.flushListeners.splice(index, 1)
    }
  }

  /**
   * Добавляет элемент в буфер, разгрузки никто не ждёт.
   */
  push = (item: T): void => {
    this.put(item, undefined)
  }

  /**
   * Кладёт элемент в буфер и ждёт, пока его пачка выгрузится.
   *
   * Промис разрешается только после успешного apply всей пачки. Если apply
   * упал, пачка возвращается в буфер, и ожидание продолжается до удачного
   * повтора — обработчик сидит на лоадере ровно столько, сколько нужно.
   *
   * Переполнение буфера приходит отказом промиса, а не синхронным броском:
   * throw внутри исполнителя промиса превращается в reject, и обработчику
   * достаточно одного catch — там же ловится и ошибка применения.
   */
  enqueue = (item: T): Promise<void> =>
    new Promise<void>((resolve) => {
      this.put(item, resolve)
    })

  private put = (item: T, flushed: (() => void) | undefined): void => {
    if (this.buffer.length >= this.options.capacity) {
      throw new BatchLaneFullError(
        this.options.name,
        this.options.capacity,
        Math.ceil(this.options.intervalMs / 1000)
      )
    }

    this.buffer.push({ item, flushed })
    this.pushedTotal += 1

    if (
      this.buffer.length >= this.options.maxBatch &&
      this.draining === undefined
    ) {
      void this.flush()
    }
  }

  /**
   * Выгружает всё, что накопилось.
   *
   * Пачки сплошным потоком, а не по одной на такт: если в буфере 5000 штук, за
   * один проход отдаём пачками по maxBatch, пока не опустеет.
   */
  flush = async (): Promise<void> => {
    while (this.draining !== undefined) {
      await this.draining
    }

    if (this.buffer.length === 0) return

    this.draining = this.drain()

    try {
      await this.draining
    } finally {
      this.draining = undefined
    }
  }

  private drain = async (): Promise<void> => {
    while (this.buffer.length > 0) {
      const slots = this.buffer.splice(0, this.options.maxBatch)
      const batch = slots.map((slot) => slot.item)

      try {
        await this.options.apply(batch)

        this.flushedTotal += batch.length
        this.lastFlushedAt = Date.now()

        this.notifyFlush(batch)

        /**
         * Ожидания разрешаем последними: клиент получает ответ только когда
         * пачка целиком принята и раздана подписчикам onFlush.
         */
        for (const slot of slots) slot.flushed?.()
      } catch (error) {
        this.buffer.unshift(...slots)

        logger.error(
          {
            err: error,
            lane: this.options.name,
            size: batch.length,
            queued: this.buffer.length,
          },
          'Не удалось применить пачку, вернул её в буфер'
        )

        break
      }
    }
  }

  /**
   * Ошибки слушателя гасим здесь же: разгрузка уже прошла успешно, и падение
   * наблюдателя не имеет права вернуть пачку в буфер или оборвать остальных.
   */
  private notifyFlush = (batch: T[]): void => {
    for (const listener of this.flushListeners) {
      try {
        listener(batch)
      } catch (error) {
        logger.error(
          { err: error, lane: this.options.name, size: batch.length },
          'Слушатель разгрузки упал'
        )
      }
    }
  }

  /**
   * Останавливает таймер и досылает остаток.
   */
  stop = async (): Promise<void> => {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }

    await this.flush()

    if (this.buffer.length > 0) {
      logger.error(
        { lane: this.options.name, lost: this.buffer.length },
        'Очередь не разгрузилась при остановке, элементы потеряны'
      )
    }
  }

  stats = (): {
    queued: number
    pushedTotal: number
    flushedTotal: number
    lastFlushedAt: number | undefined
  } => ({
    queued: this.buffer.length,
    pushedTotal: this.pushedTotal,
    flushedTotal: this.flushedTotal,
    lastFlushedAt: this.lastFlushedAt,
  })
}
