import { LRUCache } from 'lru-cache'

import { DEDUP_MAX_ENTRIES, DEDUP_TTL_MS } from '../configs/dedup.config'

/**
 * Что прислал клиент и на какое тело это было. Если один и тот же ключ
 * приходит с другим телом, это не повтор, а попытка переиспользовать ключ
 * под другую операцию — такому отвечают 409, а не отдают чужой ответ.
 */
type CacheEntry = {
  fingerprint: string
  /** Промис первой попытки: пока он висит, повторы ждут именно его */
  pending: Promise<unknown>
  /** Ответ после успеха, чтобы повтор позже не начинал работу заново */
  isDone: boolean
  answer?: unknown
}

const seen = new LRUCache<string, CacheEntry>({
  max: DEDUP_MAX_ENTRIES,
  ttl: DEDUP_TTL_MS,
  ttlAutopurge: true,
})

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Заголовок Idempotency-Key уже использован для другого тела запроса')

    this.name = 'IdempotencyConflictError'
  }
}

/**
 * Ключ дедупликации.
 *
 * С заголовком это сам заголовок: клиент сам решил, что перед ним одна
 * операция, и при повторах переиспользует то же значение. Без заголовка ключом
 * становится отпечаток тела вместе с методом и путём, иначе одинаковые тела на
 * разных маршрутах склеились бы в один ответ.
 */
export const dedupKey = (
  header: string | undefined,
  fingerprint: string,
  scope: string
): string => {
  if (header !== undefined) return `key:${scope}:${header}`

  return `body:${scope}:${fingerprint}`
}

/**
 * Выполняет действие один раз на ключ.
 *
 * Пока первая попытка в работе, все последующие ждут тот же промис. Это и
 * склейка параллельных дублей, и настоящая идемпотентность: после успеха ответ
 * остаётся в кэше на TTL, и повтор позже получает тот же результат.
 *
 * Ошибки не запоминаются. Иначе клиент, повторивший запрос после чужой неудачи,
 * получил бы в кэш чужую ошибку и уже не смог бы повторить ещё раз.
 */
export const dedup = async <T>(
  key: string,
  fingerprint: string,
  action: () => Promise<T>
): Promise<T> => {
  const cached = seen.get(key)

  if (cached !== undefined) {
    /**
     * Расхождение отпечатков возможно только для ключа из заголовка: там тело
     * в ключ не входит и сверяется отдельно.
     */
    if (cached.fingerprint !== fingerprint) {
      throw new IdempotencyConflictError()
    }

    if (cached.isDone) return cached.answer as T

    return cached.pending as Promise<T>
  }

  const pending = action()
  const entry: CacheEntry = { fingerprint, pending, isDone: false }

  /**
   * Запись появляется до первого await, поэтому два параллельных запроса с
   * одинаковым ключом гарантированно встретят друг друга: между этими
   * строками event loop не прерывается.
   */
  seen.set(key, entry)

  try {
    const answer = await pending

    entry.isDone = true
    entry.answer = answer

    /**
     * TTL отсчитывается от постановки, а не от ответа. С батчем в 10 секунд
     * запись и так истекла бы к моменту завершения, и повтор на 11-й секунде
     * создал бы вторую работу. Переустановка продлевает окно доиспользования
     * на полный TTL уже после успеха.
     */
    seen.set(key, entry)

    return answer
  } catch (error) {
    seen.delete(key)

    throw error
  }
}
