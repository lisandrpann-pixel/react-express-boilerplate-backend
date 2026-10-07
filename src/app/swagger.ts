import path from 'node:path'
import swaggerJsdoc from 'swagger-jsdoc'

import { logger } from '../shared/services/logger'
import { PORT_DEFAULT } from './config'

const pagesDir = path.resolve(__dirname, '../pages').replace(/\\/g, '/')

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API',
      version: '1.0.0',
      description: [
        'Любая ошибка возвращается в JSON в виде { "error": "текст" }.',
        '',
        'GET /health не проходит через троттлинг и отдаёт 503 во время остановки.',
        '',
        'Ответы, общие для всех маршрутов:',
        '- 404 { "error": "Маршрут GET /some/path не найден" } — путь не совпал ни с одним маршрутом;',
        '- 400 { "error": "Тело запроса не является корректным JSON" } — тело не удалось распарсить;',
        '- 413 { "error": "Тело запроса превышает допустимый размер" } — тело больше 100 kb;',
        '- 500 { "error": "Внутренняя ошибка сервера" } — подробности только в логах сервера.',
      ].join('\n'),
    },
    servers: [{ url: `http://localhost:${process.env.PORT || PORT_DEFAULT}` }],
  },
  apis: [`${pagesDir}/**/*.{js,ts}`],
}

const swaggerSpec = swaggerJsdoc(options)

const paths = (swaggerSpec as { paths?: Record<string, unknown> }).paths ?? {}

if (Object.keys(paths).length === 0) {
  logger.error({ apis: options.apis }, 'Swagger-аннотации не найдены')
}

export default swaggerSpec
