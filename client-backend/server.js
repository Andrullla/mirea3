const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
const PORT = 8080;

// Кэш для хранения данных
let productsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 минута

app.use(cors());
app.use(bodyParser.json());

// Статические файлы для клиентской части
app.use(express.static(path.join(__dirname, '../client-frontend')));
// Статические файлы для админ-панели
app.use('/admin', express.static(path.join(__dirname, '../admin-frontend')));

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client-frontend/index.html'));
});

// Маршрут для админ-панели
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-frontend/index.html'));
});

// Функция для получения данных с админ-сервера
async function fetchFromAdmin() {
  try {
    const response = await fetch('http://localhost:3000/api/products');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    productsCache = data;
    lastFetchTime = Date.now();
    return data;
  } catch (error) {
    console.error('Ошибка при получении данных с админ-сервера:', error);
    throw error;
  }
}

// Проксирование запросов к админ API
app.get('/api/products', async (req, res) => {
  try {
    // Проверяем, есть ли актуальные данные в кэше
    if (productsCache && Date.now() - lastFetchTime < CACHE_DURATION) {
      return res.json(productsCache);
    }

    // Если кэш устарел или отсутствует, пытаемся получить новые данные
    const data = await fetchFromAdmin();
    res.json(data);
  } catch (error) {
    // Если есть кэш, возвращаем его даже если он устарел
    if (productsCache) {
      console.log('Возвращаем кэшированные данные из-за ошибки');
      return res.json(productsCache);
    }
    res.status(500).json({ error: 'Ошибка сервера', message: 'Не удалось получить данные' });
  }
});

// Остальные API запросы проксируем напрямую
app.all('/api/*', async (req, res) => {
  if (req.path === '/api/products') return; // Пропускаем, так как уже обработано выше
  
  try {
    const adminUrl = 'http://localhost:3000' + req.url;
    const response = await fetch(adminUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Ошибка при проксировании запроса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Клиентский сервер запущен на порту ${PORT}`);
});