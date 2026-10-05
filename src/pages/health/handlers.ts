import { RequestHandler } from 'express'

import { isShuttingDown } from '../../shared/state/lifecycle'
import { ResponseHealth } from '../../shared/types/health.types'

const startedAt = Date.now()

/**
 * Liveness и readiness в одном ответе: 200 пока процесс готов принимать трафик,
 * 503 когда он уже остановлен и его пора вывести из балансировки.
 */
export const getHealth: RequestHandler = (_req, res) => {
  const isDown = isShuttingDown()
  const body: ResponseHealth = {
    status: isDown ? 'shutting down' : 'ok',
    uptime: Math.round((Date.now() - startedAt) / 1000),
  }

  res.status(isDown ? 503 : 200).json(body)
}
