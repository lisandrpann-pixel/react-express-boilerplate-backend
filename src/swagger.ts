import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API',
      version: '1.0.0',
      description: 'Swagger',
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: ['pages/users/routes.ts'],
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
