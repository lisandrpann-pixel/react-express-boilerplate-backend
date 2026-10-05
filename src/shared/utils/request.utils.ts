import { randomUUID, createHash } from 'node:crypto'
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

/**
 * Отпечаток тела: одинаковые по смыслу запросы должны давать одинаковый ключ
 * независимо от порядка полей. Порядок в JSON не значит ничего, поэтому ключи
 * сортируются рекурсивно. Без этого `{a:1,b:2}` и `{b:2,a:1}` сочлись бы
 * разными дублями одного запроса.
 */
export const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize)

  if (value === null || typeof value !== 'object') return value

  const source = value as Record<string, unknown>

  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => [key, canonicalize(source[key])])
  )
}

export const fingerprintOf = (body: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonicalize(body ?? null)))
    .digest('base64url')