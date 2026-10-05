import slowDown from 'express-slow-down'

export const PORT_DEFAULT = 3000

export const LIMITTER = slowDown({
  windowMs: 2 * 60 * 1000,
  delayAfter: 1,
  delayMs: () => 1000,
  maxDelayMs: 1000,
})

/**
 * Сколько ждать, пока соединения закроются и логи сбросятся, прежде чем
 * выйти принудительно. Если за это время не уложились — значит что-то
 * держит сокет, и ждать дальше бессмысленно
 */
export const SHUTDOWN_TIMEOUT_MS = 10_000
