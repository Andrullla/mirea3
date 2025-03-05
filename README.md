# Интернет-магазин электроники

Проект представляет собой веб-приложение интернет-магазина с админ-панелью для управления товарами.

## Структура проекта

```
shop-project/
├── admin-backend/        # Бэкенд админ-панели
│   ├── data/            # Хранение данных в JSON
│   ├── server.js        # Сервер админ-панели
│   └── package.json     # Зависимости админ-части
├── admin-frontend/      # Фронтенд админ-панели
│   └── index.html      # Интерфейс админ-панели
├── client-backend/     # Клиентский бэкенд
│   ├── server.js       # Клиентский сервер
│   └── package.json    # Зависимости клиентской части
└── client-frontend/    # Клиентский фронтенд
    └── index.html      # Интерфейс магазина
```

## Функциональность

### Клиентская часть
- Просмотр каталога товаров
- Фильтрация по категориям и подкатегориям
- Отображение цен в удобном формате
- Кэширование данных для стабильной работы

### Админ-панель
- Добавление новых товаров
- Редактирование существующих товаров
- Удаление товаров
- Управление категориями

## Технологии
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **Хранение данных**: JSON
- **Дополнительно**: CORS, body-parser, node-fetch

## Установка и запуск

1. Установка зависимостей для админ-сервера:
```bash
cd admin-backend
npm install
```

2. Установка зависимостей для клиентского сервера:
```bash
cd client-backend
npm install
```

3. Запуск админ-сервера (порт 3000):
```bash
cd admin-backend
node server.js
```

4. Запуск клиентского сервера (порт 8080):
```bash
cd client-backend
node server.js
```

5. Открыть в браузере:
- Магазин: http://localhost:8080
- Админ-панель: http://localhost:8080/admin

## Особенности реализации

### Система кэширования
- Клиентский сервер кэширует данные на 1 минуту
- При недоступности админ-сервера используются кэшированные данные
- Фронтенд хранит локальную копию данных для быстрой фильтрации

### Категории товаров
- Основные категории: Электроника, Компьютеры, Телефоны
- Подкатегории для каждой основной категории
- Двухуровневая система фильтрации

### Обработка ошибок
- Graceful degradation при недоступности сервера
- Информативные сообщения об ошибках
- Автоматическое восстановление при доступности сервера

## API Endpoints

### Админ API (порт 3000)
- `GET /api/products` - получение списка товаров
- `POST /api/products` - добавление товара
- `PUT /api/products/:id` - обновление товара
- `DELETE /api/products/:id` - удаление товара

### Клиентский API (порт 8080)
- `GET /api/products` - получение списка товаров (с кэшированием)
- Проксирование остальных запросов на админ-сервер 