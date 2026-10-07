import { Router } from 'express'
import {
  changeItemHandler,
  createItemHandler,
  getItemByIdHandler,
  getItemsHandler,
} from './handlers'

const router = Router()

/**
 * @swagger
 * /api/items:
 *   get:
 *     summary: Получить элемены
 *     description: >
 *       Возвращает страницу элементов с учётом фильтра по id и isChosen.
 *       По умолчанию отдаются первые 20. Если limit больше 100, значение
 *       ограничивается до 100. Фильтрация применяется до пагинации,
 *       поэтому offset отсчитывается уже по отфильтрованной выборке,
 *       а total показывает количество элементов после фильтрации.
 *
 *       Чтение не выполняется сразу: запрос ложится в линию чтения и
 *       ждёт разгрузки пачки (раз в секунду), поэтому ответ может
 *       задержаться. Все чтения одной пачки считаются по одному снапшоту
 *       и видят одно и то же состояние.
 *
 *       В data.json хранится 1000000 элементов с id от 1 до 1000000,
 *       у всех isChosen равно false, а order совпадает с id.
 *     tags:
 *       - Items
 *     parameters:
 *       - name: offset
 *         in: query
 *         required: false
 *         description: Количество пропускаемых элементов
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Максимальное количество элементов в ответе
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
 *           Признак, выбран ли элемент или нет. Если isChosen
 *           true, возвращаются элементы с isChosen=true,
 *           если false, возвращаются с isChosen=false, иначе
 *           возвращаются все элементы. Ответ с учетом пагинации.
 *         schema:
 *           type: boolean
 *           example: true
 *     responses:
 *       '200':
 *         description: Страница элементов
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
 *                         description: Отмечен ли элемент как выбранный
 *                         example: false
 *                       order:
 *                         type: integer
 *                         description: Порядковый номер элемента
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
 *                       description: Количество элементов после фильтрации
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
 *                   - 'Некорректный offset: ожидается целое положительное число'
 *                   - 'Некорректный limit: ожидается целое положительное число'
 *                   - 'Некорректный id: ожидаемый формат - число (1), диапазон (1-12, 42)'
 *       '503':
 *         description: >
 *           Линия чтения переполнена: разгрузка не успевает за потоком
 *           запросов. Повторите попытку позже — заголовок Retry-After
 *           указывает, через сколько секунд проверить
 *         headers:
 *           Retry-After:
 *             description: Через сколько секунд имеет смысл повторить запрос
 *             schema:
 *               type: integer
 *               example: 1
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Очередь «чтение» заполнена, попробуйте позже'
 */
router.get('/items', getItemsHandler)

/**
 * @swagger
 * /api/items:
 *   post:
 *     summary: Добавить элемент
 *     description: >
 *       Добавляет элемент в тот же набор данных, из которого
 *       читаются элементы для GET /api/items. Новый элемент
 *       получает isChosen равный false и order равный своему id.
 *       Данные хранятся только в памяти процесса, data.json не
 *       изменяется, поэтому после перезапуска сервера созданные
 *       элементы исчезают.
 *
 *       Элемент не применяется сразу: запрос кладётся в буфер и
 *       добавляется одним пакетом раз в 10 секунд, поэтому ответ —
 *       202 Accepted с заголовком Retry-After. Пока элемент в
 *       буфере, GET /api/items возвращает без него, а после
 *       разгрузки он появляется. Повторять запрос не нужно.
 *
 *       Если элемент уже в буфере, второй POST с тем же id
 *       отклоняется с 400 — до разгрузки ещё никого нет в базе,
 *       поэтому обычной проверки «уже существует» здесь недостаточно.
 *       Повтор того же запроса в течение 10 секунд не создаёт
 *       элемент заново, а возвращает тот же ответ 202.
 *     tags:
 *       - Items
 *     parameters:
 *       - name: Idempotency-Key
 *         in: header
 *         required: false
 *         description: >
 *           Ключ идемпотентности операции. Один ключ — одна операция:
 *           при повторах клиент переиспользует то же значение и получает
 *           тот же ответ, а работа выполняется один раз. Без заголовка
 *           запросы с одинаковым телом склеиваются, но только пока первый
 *           ещё выполняется. Тот же ключ с другим телом отклоняется.
 *         schema:
 *           type: string
 *           maxLength: 255
 *           example: 3f2504e0-4f89-11d3-9a0c-0305e82c3301
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
 *                 description: Идентификатор элемента, должен быть свободен
 *                 example: 1000001
 *     responses:
 *       '202':
 *         description: >
 *           Элемент принят и поставлен в очередь. Он появится в GET после
 *           следующей разгрузки — не позднее 10 секунд
 *         headers:
 *           Retry-After:
 *             description: Через сколько секунд имеет смысл проверить GET
 *             schema:
 *               type: integer
 *               example: 10
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - id
 *                 - isChosen
 *                 - order
 *                 - status
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
 *                 status:
 *                   type: string
 *                   enum:
 *                     - queued
 *                   description: >
 *                     Элемент ещё не применён, лежит в буфере. Поля итоговые,
 *                     клиент уже видит будущий результат
 *                   example: queued
 *       '400':
 *         description: >
 *           id отсутствует, не является положительным целым числом,
 *           уже занят в базе или ещё в буфере добавления
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
 *                     - 'Элемент с id 1 уже существует'
 *                     - 'Элемент с id 1 уже создаётся, дождитесь появления'
 *       '409':
 *         description: >
 *           Заголовок Idempotency-Key ранее был использован для другого
 *           тела запроса
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Заголовок Idempotency-Key уже использован для другого тела запроса'
 *       '413':
 *         description: Тело запроса превышает допустимый размер
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Тело запроса превышает допустимый размер'
 *       '503':
 *         description: >
 *           Буфер добавления переполнен: разгрузка не успевает за потоком
 *           запросов. Повторите попытку позже — заголовок Retry-After
 *           указывает, через сколько секунд проверить
 *         headers:
 *           Retry-After:
 *             description: Через сколько секунд имеет смысл повторить запрос
 *             schema:
 *               type: integer
 *               example: 10
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Очередь «создание» заполнена, попробуйте позже'
 */
router.post('/items', createItemHandler)

/**
 * @swagger
 * /api/items:
 *   put:
 *     summary: Изменить элемент
 *     description: >
 *       Полностью заменяет элемент с указанным id: в памяти
 *       обновляются поля isChosen и order.
 *
 *       Изменение не применяется сразу: запрос ложится в линию изменений
 *       и применяется пачкой раз в секунду, поэтому ответ 200 уходит только
 *       после разгрузки — клиент ждёт на лоадере, а не получает 202. После
 *       разгрузки элемент отдаётся в GET /api/items и GET /api/items/{id}
 *       с новыми значениями. Данные хранятся только в памяти процесса, data.json
 *       не изменяется, поэтому после перезапуска сервера изменения
 *       теряются. Элемент с неизвестным id изменить нельзя. Повтор того же
 *       запроса в течение 10 секунд возвращает тот же ответ, что и первый.
 *     tags:
 *       - Items
 *     parameters:
 *       - name: Idempotency-Key
 *         in: header
 *         required: false
 *         description: >
 *           Ключ идемпотентности операции. Один ключ — одна операция:
 *           при повторах клиент переиспользует то же значение и получает
 *           тот же ответ, а работа выполняется один раз. Без заголовка
 *           запросы с одинаковым телом склеиваются, но только пока первый
 *           ещё выполняется. Тот же ключ с другим телом отклоняется.
 *         schema:
 *           type: string
 *           maxLength: 255
 *           example: 3f2504e0-4f89-11d3-9a0c-0305e82c3301
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
 *                 description: Идентификатор изменяемого элемента
 *                 example: 1
 *               isChosen:
 *                 type: boolean
 *                 description: Отмечен ли элемент как выбранный
 *                 example: true
 *               order:
 *                 type: integer
 *                 description: Новый порядковый номер элемента
 *                 example: 10
 *     responses:
 *       '200':
 *         description: Элемент изменён
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
 *         description: >
 *           Некорректный id, либо isChosen не boolean, либо order не целое
 *           число
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
 *                     - 'Некорректные данные: isChosen должен быть boolean, order — целым числом'
 *       '404':
 *         description: Элемент не найден
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
 *       '409':
 *         description: >
 *           Заголовок Idempotency-Key ранее был использован для другого
 *           тела запроса
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Заголовок Idempotency-Key уже использован для другого тела запроса'
 *       '413':
 *         description: Тело запроса превышает допустимый размер
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Тело запроса превышает допустимый размер'
 *       '503':
 *         description: >
 *           Линия изменений переполнена: разгрузка не успевает за потоком
 *           запросов. Повторите попытку позже — заголовок Retry-After
 *           указывает, через сколько секунд проверить
 *         headers:
 *           Retry-After:
 *             description: Через сколько секунд имеет смысл повторить запрос
 *             schema:
 *               type: integer
 *               example: 1
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - error
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Очередь «изменение» заполнена, попробуйте позже'
 */
router.put('/items', changeItemHandler)

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     summary: Получить элемент по ID
 *     description: >
 *       Ищет элемент по полю `id`. Элемент должен существовать
 *       в наборе данных, сформированном из data.json и дополненного
 *       запросами POST /api/items и PUT /api/items.
 *     tags:
 *       - Items
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Идентификатор элемента
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       '200':
 *         description: Найденный элемент
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
 *         description: Элемент не найден
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
router.get('/items/:id', getItemByIdHandler)

export default router
