import express from 'express'
import usersRouter from './pages/users/routes'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.use('/api', usersRouter)

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
