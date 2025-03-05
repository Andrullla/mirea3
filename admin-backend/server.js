const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Проверка работоспособности сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const dataPath = path.join(__dirname, 'data', 'products.json');

// Получение всех товаров
app.get('/api/products', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка чтения данных' });
    }
    res.json(JSON.parse(data));
  });
});

// Добавление товара
app.post('/api/products', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка чтения данных' });
    }

    const products = JSON.parse(data);
    const newProducts = Array.isArray(req.body) ? req.body : [req.body];
    
    newProducts.forEach(product => {
      product.id = Math.max(...products.products.map(p => p.id), 0) + 1;
      products.products.push(product);
    });

    fs.writeFile(dataPath, JSON.stringify(products, null, 2), err => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сохранения данных' });
      }
      res.json(products);
    });
  });
});

// Редактирование товара
app.put('/api/products/:id', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка чтения данных' });
    }

    const products = JSON.parse(data);
    const productId = parseInt(req.params.id);
    const productIndex = products.products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    products.products[productIndex] = { ...products.products[productIndex], ...req.body };

    fs.writeFile(dataPath, JSON.stringify(products, null, 2), err => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сохранения данных' });
      }
      res.json(products.products[productIndex]);
    });
  });
});

// Удаление товара
app.delete('/api/products/:id', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка чтения данных' });
    }

    const products = JSON.parse(data);
    const productId = parseInt(req.params.id);
    const productIndex = products.products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    products.products.splice(productIndex, 1);

    fs.writeFile(dataPath, JSON.stringify(products, null, 2), err => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка сохранения данных' });
      }
      res.json({ message: 'Товар успешно удален' });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Админ-сервер запущен на порту ${PORT}`);
}); 