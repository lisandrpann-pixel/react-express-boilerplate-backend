import { randomUUID } from 'node:crypto'
import { IncomingMessage } from 'node:http'

import { UUID_PATTERN } from '../configs/request.config'

export const resolveRequestId = (req: IncomingMessage): string => {
  const incoming = req.headers['x-request-id']
  const value = Array.isArray(incoming) ? incoming[0] : incoming

  if (typeof value === 'string' && UUID_PATTERN.test(value.trim())) {
    return value.trim()
  }

  return randomUUID()
}