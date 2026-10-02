import { Router } from 'express'
import { getUserById, getUsers } from './handlers'

const router = Router()

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Получить пользователей
 *     description: >
 *       Возвращает страницу пользователей. По умолчанию отдаются первые 20.
 *       Если limit больше 100, значение ограничивается до 100.
 *     tags:
 *       - Users
 *     parameters:
 *       - name: offset
 *         in: query
 *         required: false
 *         description: Количество пропускаемых пользователей
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Максимальное количество пользователей в ответе
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 100
 *           default: 20
 *       - name: userIdFilter
 *         in: query
 *         required: false
 *         description: Фильтр по id пользователя
 *         schema:
 *           type: string
 *           default: ""
 *     responses:
 *       '200':
 *         description: Страница пользователей
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - data
 *                 - pagination
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required:
 *                       - _id
 *                       - index
 *                       - name
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 6abd36d863527fa0bfea56b6
 *                       index:
 *                         type: integer
 *                         example: 0
 *                       name:
 *                         type: string
 *                         example: Davis Gay
 *                 pagination:
 *                   type: object
 *                   required:
 *                     - offset
 *                     - limit
 *                     - total
 *                     - hasMore
 *                   properties:
 *                     offset:
 *                       type: integer
 *                       example: 0
 *                     userIdFilter:
 *                       type: string
 *                       example: "6abd36d86f3bc69b539086d4"
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 1000000
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *       '400':
 *         description: offset или limit не является неотрицательным целым числом
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Invalid limit: expected a non-negative integer'
 */
router.get('/users', getUsers)

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Получить пользователя по ID
 *     description: Ищет пользователя по полю `_id`
 *     tags:
 *       - Users
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Идентификатор пользователя
 *         schema:
 *           type: string
 *           example: 6abd36d863527fa0bfea56b6
 *     responses:
 *       '200':
 *         description: Найденный пользователь
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - _id
 *                 - index
 *                 - name
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: 6abd36d863527fa0bfea56b6
 *                 index:
 *                   type: integer
 *                   example: 0
 *                 name:
 *                   type: string
 *                   example: Davis Gay
 *       '404':
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: User not found
 */
router.get('/users/:id', getUserById)

export default router
