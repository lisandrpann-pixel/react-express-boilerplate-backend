import slowDown from 'express-slow-down'

export const PORT_DEFAULT = 3000

export const LIMITTER = slowDown({
  windowMs: 2 * 60 * 1000,
  delayAfter: 1,
  delayMs: 1000,
  maxDelayMs: 1000,
})
