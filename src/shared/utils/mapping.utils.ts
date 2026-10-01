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
