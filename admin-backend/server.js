const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Создаем необходимые директории при запуске
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');

// Создаем директории, если они не существуют
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Создаем файл с данными, если он не существует
const dataPath = path.join(dataDir, 'products.json');
if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ products: [] }, null, 2));
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            cb(new Error('Неверный формат файла. Разрешены только JPEG, PNG и GIF'));
            return;
        }
        cb(null, true);
    }
});

app.use(cors());
app.use(bodyParser.json());
// Раздаем статические файлы из папки uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Проверка работоспособности сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Получение всех товаров
app.get('/api/products', (req, res) => {
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Ошибка чтения файла:', err);
            return res.status(500).json({ error: 'Ошибка чтения данных' });
        }
        res.json(JSON.parse(data));
    });
});

// Получение одного товара
app.get('/api/products/:id', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        if (isNaN(productId)) {
            return res.status(400).json({ error: 'Неверный формат ID' });
        }

        const data = fs.readFileSync(path.join(dataDir, 'products.json'), 'utf8');
        const products = JSON.parse(data);
        
        const product = products.products.find(p => p.id === productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        res.json(product);
    } catch (error) {
        console.error('Ошибка при получении товара:', error);
        res.status(500).json({ error: 'Ошибка при получении товара', details: error.message });
    }
});

// Добавление товара
app.post('/api/products', (req, res) => {
    try {
        console.log('Получен запрос на добавление товара:', req.body);

        // Проверяем обязательные поля
        if (!req.body.name || !req.body.price || !req.body.category) {
            console.log('Отсутствуют обязательные поля');
            return res.status(400).json({ 
                error: 'Не все обязательные поля заполнены',
                required: ['name', 'price', 'category'],
                received: req.body 
            });
        }

        // Читаем текущие данные
        let products;
        try {
            const data = fs.readFileSync(dataPath, 'utf8');
            products = JSON.parse(data);
        } catch (err) {
            console.log('Ошибка чтения файла, создаем новую структуру');
            products = { products: [] };
        }

        // Создаем новый товар
        const newProduct = {
            id: products.products.length > 0 ? Math.max(...products.products.map(p => p.id)) + 1 : 1,
            name: req.body.name.trim(),
            price: parseFloat(req.body.price),
            category: req.body.category.trim(),
            description: req.body.description ? req.body.description.trim() : '',
            imageUrl: null
        };

        console.log('Создан новый товар:', newProduct);

        // Добавляем товар в массив
        products.products.push(newProduct);

        // Записываем обновленные данные
        fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
        console.log('Товар успешно добавлен в файл');
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Ошибка при добавлении товара:', error);
        res.status(500).json({ error: 'Ошибка при добавлении товара', details: error.message });
    }
});

// Обновление товара
app.put('/api/products/:id', (req, res) => {
    try {
        console.log('Получен запрос на обновление товара:', req.params.id);
        console.log('Данные для обновления:', req.body);

        const productId = parseInt(req.params.id);
        
        if (isNaN(productId)) {
            return res.status(400).json({ error: 'Неверный формат ID' });
        }

        if (!req.body.name || !req.body.price || !req.body.category) {
            return res.status(400).json({ 
                error: 'Не все обязательные поля заполнены',
                required: ['name', 'price', 'category'],
                received: req.body 
            });
        }

        const data = fs.readFileSync(path.join(dataDir, 'products.json'), 'utf8');
        const products = JSON.parse(data);
        
        const productIndex = products.products.findIndex(p => p.id === productId);
        
        if (productIndex === -1) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Обновляем данные товара
        const updatedProduct = {
            ...products.products[productIndex],
            name: req.body.name.trim(),
            price: parseFloat(req.body.price),
            category: req.body.category.trim(),
            description: req.body.description ? req.body.description.trim() : ''
        };

        products.products[productIndex] = updatedProduct;

        fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(products, null, 2));
        
        console.log('Товар успешно обновлен:', updatedProduct);
        res.json(updatedProduct);
    } catch (error) {
        console.error('Ошибка при обновлении товара:', error);
        res.status(500).json({ error: 'Ошибка при обновлении товара', details: error.message });
    }
});

// Удаление товара
app.delete('/api/products/:id', (req, res) => {
    try {
        console.log('Получен запрос на удаление товара:', req.params.id);
        
        const productId = parseInt(req.params.id);
        
        // Проверяем, что ID является числом
        if (isNaN(productId)) {
            console.log('Неверный формат ID:', req.params.id);
            return res.status(400).json({ error: 'Неверный формат ID' });
        }

        // Читаем текущие данные
        const data = fs.readFileSync(dataPath, 'utf8');
        const products = JSON.parse(data);

        // Находим индекс товара
        const productIndex = products.products.findIndex(p => p.id === productId);

        if (productIndex === -1) {
            console.log('Товар не найден:', productId);
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Получаем информацию о товаре перед удалением
        const product = products.products[productIndex];
        console.log('Найден товар для удаления:', product);

        // Удаляем изображение, если оно есть
        if (product.imageUrl) {
            const imagePath = path.join(__dirname, product.imageUrl.replace('/uploads', 'uploads'));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                console.log('Удалено изображение:', imagePath);
            }
        }

        // Удаляем товар из массива
        products.products.splice(productIndex, 1);

        // Записываем обновленные данные
        fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
        
        console.log('Товар успешно удален:', productId);
        res.json({ message: 'Товар успешно удален', deletedId: productId });
    } catch (error) {
        console.error('Ошибка при удалении товара:', error);
        res.status(500).json({ error: 'Ошибка при удалении товара', details: error.message });
    }
});

// Загрузка изображения для товара
app.post('/api/products/:id/image', upload.single('image'), async (req, res) => {
    try {
        console.log('Получен запрос на загрузку изображения для товара:', req.params.id);
        
        if (!req.file) {
            console.log('Файл не был загружен');
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const productId = parseInt(req.params.id);
        const imageUrl = `/uploads/${req.file.filename}`;
        
        // Читаем текущие данные
        const data = fs.readFileSync(path.join(dataDir, 'products.json'), 'utf8');
        const products = JSON.parse(data);
        
        // Находим товар
        const product = products.products.find(p => p.id === productId);
        if (!product) {
            // Удаляем загруженный файл
            fs.unlinkSync(path.join(__dirname, req.file.path));
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Удаляем старое изображение, если оно есть
        if (product.imageUrl) {
            const oldImagePath = path.join(__dirname, product.imageUrl.replace('/uploads', 'uploads'));
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }

        // Обновляем URL изображения
        product.imageUrl = imageUrl;
        
        // Сохраняем обновленные данные
        fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(products, null, 2));
        
        console.log('Изображение успешно загружено:', imageUrl);
        res.json({ imageUrl });
    } catch (error) {
        console.error('Ошибка при загрузке изображения:', error);
        res.status(500).json({ error: 'Ошибка при загрузке изображения', details: error.message });
    }
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
    console.log(`Админ-сервер запущен на порту ${PORT}`);
    console.log(`Директория для данных: ${dataDir}`);
    console.log(`Директория для загрузок: ${uploadsDir}`);
}); 