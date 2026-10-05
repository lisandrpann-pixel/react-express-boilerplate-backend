import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API',
      version: '1.0.0',
      description: [
        'Любая ошибка возвращается в JSON в виде { "error": "текст" }.',
        '',
        'Ответы, общие для всех маршрутов:',
        '- 404 { "error": "Маршрут GET /some/path не найден" } — путь не совпал ни с одним маршрутом;',
        '- 400 { "error": "Тело запроса не является корректным JSON" } — тело не удалось распарсить;',
        '- 413 { "error": "Тело запроса превышает допустимый размер" } — тело больше 100 kb;',
        '- 500 { "error": "Внутренняя ошибка сервера" } — подробности только в логах сервера.',
      ].join('\n'),
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: ['./src/pages/**/routes.ts'],
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
