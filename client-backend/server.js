const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const WebSocket = require('ws');
const http = require('http');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const PORT = 8080;

// Создаем HTTP сервер
const server = http.createServer(app);

// Создаем WebSocket сервер
const wss = new WebSocket.Server({ server });

// Храним активные соединения
const clients = new Map();
const clientToAdmin = new Map(); // Связь клиент -> админ

// Обработка WebSocket соединений
wss.on('connection', (ws, req) => {
    const clientId = Date.now();
    // Определяем тип клиента по URL
    const isAdmin = req.url.includes('/admin');
    const clientType = isAdmin ? 'admin' : 'customer';
    clients.set(ws, { id: clientId, type: clientType });

    // Отправляем приветственное сообщение
    ws.send(JSON.stringify({
        type: 'system',
        message: isAdmin ? 'Добро пожаловать в панель поддержки!' : 'Добро пожаловать в чат поддержки!'
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const sender = clients.get(ws);
            
            if (sender.type === 'admin') {
                // Если отправитель админ, находим конкретного клиента по ID
                const targetClientId = data.recipientId;
                clients.forEach((client, clientWs) => {
                    if (client.id === targetClientId && clientWs.readyState === WebSocket.OPEN) {
                        // Отправляем сообщение только конкретному клиенту
                        clientWs.send(JSON.stringify({
                            type: 'support',
                            message: data.message,
                            timestamp: new Date().toISOString()
                        }));
                        
                        // Сохраняем связь клиент -> админ
                        clientToAdmin.set(targetClientId, ws);
                    }
                });
            } else {
                // Если отправитель клиент
                const adminWs = clientToAdmin.get(sender.id);
                
                // Если у клиента уже есть связанный админ, отправляем сообщение ему
                if (adminWs && adminWs.readyState === WebSocket.OPEN) {
                    adminWs.send(JSON.stringify({
                        type: 'customer',
                        message: data.message,
                        timestamp: new Date().toISOString(),
                        clientId: sender.id
                    }));
                } else {
                    // Если нет связанного админа, отправляем всем доступным админам
                    let adminFound = false;
                    clients.forEach((client, clientWs) => {
                        if (client.type === 'admin' && clientWs.readyState === WebSocket.OPEN) {
                            clientWs.send(JSON.stringify({
                                type: 'customer',
                                message: data.message,
                                timestamp: new Date().toISOString(),
                                clientId: sender.id
                            }));
                            // Сохраняем первого ответившего админа
                            if (!adminFound) {
                                clientToAdmin.set(sender.id, clientWs);
                                adminFound = true;
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
        }
    });

    ws.on('close', () => {
        const client = clients.get(ws);
        if (client) {
            // Если это клиент, удаляем его связь с админом
            if (client.type === 'customer') {
                clientToAdmin.delete(client.id);
            }
            // Если это админ, находим и удаляем все связи с этим админом
            if (client.type === 'admin') {
                for (const [clientId, adminWs] of clientToAdmin.entries()) {
                    if (adminWs === ws) {
                        clientToAdmin.delete(clientId);
                    }
                }
            }
        }
        clients.delete(ws);
    });
});

// GraphQL схема
const typeDefs = `
  type Product {
    id: Int!
    name: String!
    price: Float!
    description: String
    category: String
    imageUrl: String
  }

  type Query {
    products: [Product]
    product(id: Int!): Product
    productsByCategory(category: String!): [Product]
    productsByPriceRange(min: Float!, max: Float!): [Product]
  }
`;

// Массив заглушек для изображений
const placeholderImages = [
    'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spacegray-select-202301?wid=904&hei=840&fmt=jpeg&qlt=90&.v=1671304673202',
    'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708',
    'https://via.placeholder.com/300x200/e74c3c/ffffff?text=Product+3',
    'https://via.placeholder.com/300x200/f1c40f/ffffff?text=Product+4',
    'https://via.placeholder.com/300x200/9b59b6/ffffff?text=Product+5'
];

// Функция для получения изображения по названию продукта
function getProductImage(product) {
    // Если название содержит "MacBook" или "Macbook", возвращаем изображение MacBook
    if (product.name.toLowerCase().includes('macbook')) {
        return placeholderImages[0];
    }
    // Если название содержит "iPhone" или "iphone", возвращаем изображение iPhone
    if (product.name.toLowerCase().includes('iphone')) {
        return placeholderImages[1];
    }
    // Иначе возвращаем случайное изображение из оставшихся
    return placeholderImages[Math.floor(Math.random() * (placeholderImages.length - 2)) + 2];
}

// Кэш для хранения данных
let productsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 минута

// Функция для получения данных с админ-сервера
async function fetchFromAdmin() {
    try {
        const response = await fetch('http://127.0.0.1:3000/api/products');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Добавляем изображения к каждому продукту
        data.products = data.products.map(product => ({
            ...product,
            imageUrl: product.imageUrl || getProductImage(product)
        }));
        productsCache = data;
        lastFetchTime = Date.now();
        return data.products;
    } catch (error) {
        console.error('Ошибка при получении данных с админ-сервера:', error);
        throw error;
    }
}

// GraphQL resolvers
const resolvers = {
    Query: {
        products: async () => {
            if (productsCache && Date.now() - lastFetchTime < CACHE_DURATION) {
                return productsCache.products;
            }
            return (await fetchFromAdmin());
        },
        product: async (_, { id }) => {
            const products = await resolvers.Query.products();
            return products.find(p => p.id === id);
        },
        productsByCategory: async (_, { category }) => {
            const products = await resolvers.Query.products();
            return products.filter(p => p.category === category);
        },
        productsByPriceRange: async (_, { min, max }) => {
            const products = await resolvers.Query.products();
            return products.filter(p => {
                // Проверяем, что цена больше или равна минимальной
                const isAboveMin = p.price >= min;
                
                // Проверяем, что цена меньше или равна максимальной
                // Если max равен MAX_SAFE_INTEGER, то считаем, что верхней границы нет
                const isBelowMax = max === Number.MAX_SAFE_INTEGER ? true : p.price <= max;
                
                return isAboveMin && isBelowMax;
            });
        }
    }
};

// Создаем исполняемую схему GraphQL
const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});

app.use(cors());
app.use(bodyParser.json());

// Настройка multer для временного хранения файлов
const upload = multer({ dest: 'temp-uploads/' });

// Статические файлы для клиентской части
app.use(express.static(path.join(__dirname, '../client-frontend')));
// Статические файлы для админ-панели
app.use('/admin', express.static(path.join(__dirname, '../admin-frontend')));

// GraphQL endpoint
app.use('/graphql', graphqlHTTP({
    schema,
    graphiql: true, // Включаем GraphiQL интерфейс для тестирования
}));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client-frontend/index.html'));
});

// Маршрут для админ-панели
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin-frontend/index.html'));
});

// Для обратной совместимости оставляем REST API
app.get('/api/products', async (req, res) => {
    try {
        if (productsCache && Date.now() - lastFetchTime < CACHE_DURATION) {
            return res.json(productsCache);
        }
        const data = await fetchFromAdmin();
        res.json({ products: data });
    } catch (error) {
        if (productsCache) {
            return res.json(productsCache);
        }
        res.status(500).json({ error: 'Ошибка сервера', message: 'Не удалось получить данные' });
    }
});

// Остальные API запросы проксируем напрямую
app.all('/api/*', upload.single('image'), async (req, res) => {
    if (req.path === '/api/products' && req.method === 'GET') return;
    
    try {
        const adminUrl = 'http://127.0.0.1:3000' + req.url;
        console.log(`Проксирование запроса: ${req.method} ${req.url}`);
        console.log('Тело запроса:', req.body);
        
        let fetchOptions = {
            method: req.method,
            headers: {}
        };

        // Если есть загруженный файл, отправляем как multipart/form-data
        if (req.file) {
            const form = new FormData();
            form.append('image', fs.createReadStream(req.file.path));
            fetchOptions.body = form;
            fetchOptions.headers = form.getHeaders();
        } else if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(req.body);
        }

        console.log('Отправка запроса на админ-сервер:', {
            url: adminUrl,
            method: fetchOptions.method,
            headers: fetchOptions.headers
        });

        const response = await fetch(adminUrl, fetchOptions);
        
        // Удаляем временный файл после отправки
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Ошибка при удалении временного файла:', err);
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Ошибка от админ-сервера:', errorData);
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        
        // Сбрасываем кэш после успешного изменения данных
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            productsCache = null;
            lastFetchTime = 0;
        }
        
        console.log(`Успешный ответ: ${req.method} ${req.url}`, data);
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Ошибка при проксировании запроса:', error);
        // Удаляем временный файл в случае ошибки
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Ошибка при удалении временного файла:', err);
            });
        }
        res.status(500).json({ 
            error: 'Ошибка сервера', 
            details: error.message,
            path: req.path,
            method: req.method
        });
    }
});

// Запускаем HTTP сервер (который также обслуживает WebSocket)
server.listen(PORT, () => {
    console.log(`Клиентский сервер запущен на порту ${PORT}`);
    console.log(`GraphQL доступен по адресу http://localhost:${PORT}/graphql`);
    console.log(`WebSocket сервер запущен на порту ${PORT}`);
});