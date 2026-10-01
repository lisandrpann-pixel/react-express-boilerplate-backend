import express from 'express'
import swaggerUi from 'swagger-ui-express'
import usersRouter from '../pages/users/routes'
import swaggerSpec from '../swagger'
import { PORT_DEFAULT } from './config'

const app = express()
const PORT = process.env.PORT || PORT_DEFAULT

app.use(express.json())

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/api', usersRouter)

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`)
})
