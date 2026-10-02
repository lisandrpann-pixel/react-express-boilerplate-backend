import { Router } from 'express'
import { createUser, getUserById, getUsers } from './handlers'

const router = Router()

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Получить пользователей
 *     description: >
 *       Возвращает страницу пользователей с учётом фильтра по id.
 *       По умолчанию отдаются первые 20. Если limit больше 100, значение
 *       ограничивается до 100. Фильтрация применяется до пагинации,
 *       поэтому offset отсчитывается уже по отфильтрованной выборке,
 *       а total показывает количество пользователей после фильтрации.
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
 *         description: >
 *           Список id через запятую, где каждый элемент это либо одно
 *           значение, либо включительный диапазон from-to.
 *           Допустимые значения 5, 1-12, 1,2,12, 1,5-9,20.
 *           Значение 1 означает ровно id 1, а не все id содержащие 1.
 *           Формы можно смешивать в одном параметре. При отсутствии
 *           параметра фильтрация не применяется. Некорректное значение,
 *           в том числе обратный диапазон 5-1, приводит к ответу 400.
 *         schema:
 *           type: string
 *           example: 1-12,42
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
 *                       - id
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
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
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       description: Количество пользователей после фильтрации
 *                       example: 12
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *                     userIdFilter:
 *                       type: string
 *                       description: Возвращается только если фильтр задан
 *                       example: 1-12,42
 *       '400':
 *         description: >
 *           Некорректный offset, limit или userIdFilter.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     - 'Некорректный offset: ожидается целое положительное число'
 *                     - 'Некорректный limit: ожидается целое положительное число'
 *                     - 'Некорректный id: ожидаемый формат - число (1), диапазон (1-12, 42)'
 */
router.get('/users', getUsers)

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Добавить пользователя
 *     description: >
 *       Добавляет пользователя в data.json, тот же файл, из которого
 *       читаются пользователи для GET /api/users. Если пользователь
 *       с таким id уже существует, возвращается 409.
 *       Запись атомарная: сначала во временный файл, затем переименование,
 *       поэтому повреждённый файл не остаётся при сбое записи.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *                 minimum: 1
 *                 description: Идентификатор пользователя, должен быть свободен
 *                 example: 1000001
 *     responses:
 *       '201':
 *         description: Пользователь создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - id
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1000001
 *       '400':
 *         description: id отсутствует или не является положительным целым числом
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Некорректный id: ожидается целое положительное число'
 *       '409':
 *         description: Пользователь с таким id уже существует
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Пользователь с id 1 уже существует'
 *       '500':
 *         description: Не удалось записать файл с пользователями
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Не удалось сохранить пользователя
 */
router.post('/users', createUser)

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Получить пользователя по ID
 *     description: Ищет пользователя по полю `id`
 *     tags:
 *       - Users
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Идентификатор пользователя
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       '200':
 *         description: Найденный пользователь
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - id
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *       '400':
 *         description: id не является целым числом
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Некорректный id: ожидается целое положительное число'
 *       '404':
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Id не найден
 */
router.get('/users/:id', getUserById)

export default router
