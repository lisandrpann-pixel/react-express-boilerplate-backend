import { Router } from 'express'
import { getUserById, getUsers } from './handlers'

const router = Router()

/**
 * @swagger
 * /example:
 *   get:
 *     summary: Получить пользователей
 *     tags:
 *       - Users
 *     responses:
 *       '200':
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 */
router.get('/users', getUsers)

/**
 * @swagger
 * /example/{id}:
 *   get:
 *     summary: Получить пользователя по ID
 *     tags:
 *       - Users
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Найденный элемент
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 */
router.get('/users/:id', getUserById)

export default router
