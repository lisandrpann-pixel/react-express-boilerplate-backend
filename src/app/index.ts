import express from 'express'
import swaggerUi from 'swagger-ui-express'

import itemsRouter from '../pages/items/routes'
import swaggerSpec from '../swagger'
import {
  errorHandler,
  notFoundHandler,
} from '../shared/middleware/error.middleware'
import {
  exposeRequestId,
  requestLogger,
} from '../shared/middleware/request-logger.middleware'
import { logger } from '../shared/logger/logger'
import { LIMITTER, PORT_DEFAULT } from './config'

const app = express()
const PORT = process.env.PORT || PORT_DEFAULT

app.use(requestLogger)
app.use(exposeRequestId)
app.use(express.json())

app.use(LIMITTER)

app.get('/api-docs/swagger.json', (_req, res) => res.json(swaggerSpec))

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/api', itemsRouter)

app.use(notFoundHandler)

app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(
    { port: PORT, swagger: `http://localhost:${PORT}/api-docs` },
    'Сервер запущен'
  )
})
