import { Router } from 'express'
import { changeItem, createItem, getItemById, getItems } from './handlers'

const router = Router()

/**
 * @swagger
 * /api/items:
 *   get:
 *     summary: Получить пользователей
 *     description: >
 *       Возвращает страницу пользователей с учётом фильтра по id и isChosen.
 *       По умолчанию отдаются первые 20. Если limit больше 100, значение
 *       ограничивается до 100. Фильтрация применяется до пагинации,
 *       поэтому offset отсчитывается уже по отфильтрованной выборке,
 *       а total показывает количество пользователей после фильтрации.
 *       В data.json хранится 1000000 пользователей с id от 1 до 1000000,
 *       у всех isChosen равно false, а order совпадает с id.
 *     tags:
 *       - Items
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
 *       - name: itemIdFilter
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
 *       - name: isChosenFilter
 *         in: query
 *         required: false
 *         description: >
 *           Признак, выбран ли пользователь или нет. Если isChosen
 *           true, возвращаются пользователи с isChosen=true,
 *           если false, возвращаются с isChosen=false, иначе
 *           возвращаются все пользователи. Ответ с учетом пагинации.
 *         schema:
 *           type: boolean
 *           example: true
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
 *                       - isChosen
 *                       - order
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       isChosen:
 *                         type: boolean
 *                         description: Отмечен ли пользователь как выбранный
 *                         example: false
 *                       order:
 *                         type: integer
 *                         description: Порядковый номер пользователя
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
 *                     itemIdFilter:
 *                       type: string
 *                       description: Возвращается только если фильтр задан
 *                       example: 1-12,42
 *                     isChosenFilter:
 *                       type: boolean
 *                       description: Возвращается только если фильтр задан
 *                       example: true
 *       '400':
 *         description: >
 *           Некорректный offset, limit или itemIdFilter.
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
router.get('/items', getItems)

/**
 * @swagger
 * /api/items:
 *   post:
 *     summary: Добавить пользователя
 *     description: >
 *       Добавляет пользователя в тот же набор данных, из которого
 *       читаются пользователи для GET /api/items. Новый пользователь
 *       получает isChosen равный false и order равный своему id.
 *       Данные хранятся только в памяти процесса, data.json не
 *       изменяется, поэтому после перезапуска сервера созданные
 *       пользователи исчезают. Если пользователь с таким id уже
 *       существует, возвращается 400.
 *     tags:
 *       - Items
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
 *                 - isChosen
 *                 - order
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1000001
 *                 isChosen:
 *                   type: boolean
 *                   example: false
 *                 order:
 *                   type: integer
 *                   example: 1000001
 *       '400':
 *         description: >
 *           id отсутствует, не является положительным целым числом
 *           или уже занят
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
 *                     - 'Некорректный id: ожидается целое положительное число'
 *                     - 'Пользователь с id 1 уже существует'
 */
router.post('/items', createItem)

/**
 * @swagger
 * /api/items:
 *   put:
 *     summary: Изменить пользователя
 *     description: >
 *       Полностью заменяет пользователя с указанным id: в памяти
 *       обновляются поля isChosen и order, после чего пользователь
 *       сразу отдаётся в GET /api/items и GET /api/items/{id} с новыми
 *       значениями. Данные хранятся только в памяти процесса, data.json
 *       не изменяется, поэтому после перезапуска сервера изменения
 *       теряются. Пользователь с неизвестным id изменить нельзя.
 *     tags:
 *       - Items
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - isChosen
 *               - order
 *             properties:
 *               id:
 *                 type: integer
 *                 minimum: 1
 *                 description: Идентификатор изменяемого пользователя
 *                 example: 1
 *               isChosen:
 *                 type: boolean
 *                 description: Отмечен ли пользователь как выбранный
 *                 example: true
 *               order:
 *                 type: integer
 *                 description: Новый порядковый номер пользователя
 *                 example: 10
 *     responses:
 *       '201':
 *         description: Пользователь изменён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - id
 *                 - isChosen
 *                 - order
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 isChosen:
 *                   type: boolean
 *                   example: true
 *                 order:
 *                   type: integer
 *                   example: 10
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
router.put('/items', changeItem)

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     summary: Получить пользователя по ID
 *     description: >
 *       Ищет пользователя по полю `id`. Пользователь должен существовать
 *       в наборе данных, сформированном из data.json и дополненного
 *       запросами POST /api/items и PUT /api/items.
 *     tags:
 *       - Items
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
 *                 - isChosen
 *                 - order
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 isChosen:
 *                   type: boolean
 *                   example: false
 *                 order:
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
router.get('/items/:id', getItemById)

export default router
