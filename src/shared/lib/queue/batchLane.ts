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
  readonly capacity: number

  constructor(name: string, capacity: number) {
    super(`Очередь «${name}» заполнена, попробуйте позже`)

    this.name = 'BatchLaneFullError'
    this.capacity = capacity
  }
}

export class BatchLane<T> {
  private readonly buffer: T[] = []
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
   * Добавляет элемент в буффер.
   */
  push = (item: T): void => {
    if (this.buffer.length >= this.options.capacity) {
      throw new BatchLaneFullError(this.options.name, this.options.capacity)
    }

    this.buffer.push(item)
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
      const batch = this.buffer.splice(0, this.options.maxBatch)

      try {
        await this.options.apply(batch)

        this.flushedTotal += batch.length
        this.lastFlushedAt = Date.now()
      } catch (error) {
        this.buffer.unshift(...batch)

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
