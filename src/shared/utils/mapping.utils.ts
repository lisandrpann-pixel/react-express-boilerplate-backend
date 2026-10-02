import { ID_PATTERN, RANGE_PATTERN } from '../configs/pagination.config'
import { IdRange } from '../types/pagination.types'

export const parseNonNegativeInt = (
  value: string | undefined,
  defaultValue: number
): number | null => {
  if (value === undefined || value === '') {
    return defaultValue
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

export const parseIdFilter = (userIdFilter?: string): IdRange[] | null => {
  if (userIdFilter === undefined || userIdFilter === '') {
    return []
  }

  const ranges: IdRange[] = []

  const idsStrArr = userIdFilter.split(',')

  for (const idStr of idsStrArr) {
    const range = RANGE_PATTERN.exec(idStr)

    if (range) {
      const [, from, to] = range

      if (from === undefined || to === undefined) {
        return null
      }

      const fromId = Number(from)
      const toId = Number(to)

      if (fromId > toId) {
        return null
      }

      ranges.push({ from: fromId, to: toId })

      continue
    }

    if (!ID_PATTERN.test(idStr)) {
      return null
    }

    const id = Number(idStr)

    ranges.push({ from: id, to: id })
  }

  return ranges
}

export const matchesIdFilter = (ranges: IdRange[], id: number): boolean =>
  ranges.some((range) => id >= range.from && id <= range.to)
