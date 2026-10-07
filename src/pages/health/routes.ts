import { Router } from 'express'

import { getHealthHandler } from './handlers'

const router = Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Проверка готовности сервиса
 *     description: >
 *       Эндпоинт для балансировщика и оркестратора. Возвращает 200, пока
 *       процесс готов принимать трафик, и 503 во время остановки, чтобы
 *       балансировщик перестал слать запросы до того, как сервер закроет
 *       соединения. Не проходит через троттлинг, поэтому проверка остаётся
 *       дешёвой и не может попасть под задержку лимитера.
 *     tags:
 *       - Health
 *     responses:
 *       '200':
 *         description: Процесс жив и готов принимать трафик
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - status
 *                 - uptime
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: integer
 *                   description: Сколько секунд процесс работает
 *                   example: 120
 *       '503':
 *         description: >
 *           Процесс останавливается и скоро перестанет принимать трафик
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - status
 *                 - uptime
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: integer
 *                   example: 120
 */
router.get('/health', getHealthHandler)

export default router
