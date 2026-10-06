let shuttingDown = false

export const isShuttingDown = (): boolean => shuttingDown

export const beginShutdown = (): void => {
  shuttingDown = true
}
