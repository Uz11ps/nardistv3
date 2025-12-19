# Руководство: Перевод дизайна из Figma на фронтенд

## Инструменты для работы с Figma

### 1. Плагины Figma для экспорта
- **Figma to React** - экспорт компонентов в React код
- **Figma to HTML/CSS** - экспорт стилей
- **Figma to Code** - автоматическая генерация CSS/React
- **Copy CSS** - копирование CSS свойств элементов

### 2. Ручной подход (рекомендуется)

## Пошаговая инструкция

### Шаг 1: Подготовка Figma файла

1. **Проверьте структуру:**
   - Убедитесь что все фреймы названы правильно
   - Используйте компоненты в Figma для повторяющихся элементов
   - Организуйте слои и группы

2. **Экспортируйте ресурсы:**
   - Выберите изображения/иконки → Export → выберите формат (SVG для иконок, PNG/JPG для изображений)
   - Сохраните в `frontend/public/` или `frontend/src/assets/`

### Шаг 2: Извлечение стилей из Figma

1. **Цвета:**
   ```css
   /* В Figma: Выберите элемент → Inspect (правая панель) → Colors */
   /* Скопируйте hex/rgb значения */
   
   /* Добавьте в index.css или создайте CSS переменные: */
   :root {
     --primary-color: #ff3333;      /* Основной цвет */
     --background-dark: #1a1a1a;    /* Фон */
     --background-card: #2a2a2a;    /* Карточки */
     --text-primary: #ffffff;       /* Текст */
     --text-secondary: #aaaaaa;     /* Вторичный текст */
   }
   ```

2. **Типографика:**
   ```css
   /* Из Figma: Выберите текст → Inspect → Typography */
   /* Скопируйте: font-family, font-size, font-weight, line-height */
   
   .font-h1 {
     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
     font-size: 32px;
     font-weight: 700;
     line-height: 1.2;
   }
   ```

3. **Отступы и размеры:**
   ```css
   /* Используйте значения из Figma (в пикселях или rem) */
   .spacing-small { padding: 8px; }
   .spacing-medium { padding: 16px; }
   .spacing-large { padding: 24px; }
   ```

4. **Скругления (border-radius):**
   ```css
   .rounded-sm { border-radius: 4px; }
   .rounded-md { border-radius: 8px; }
   .rounded-lg { border-radius: 12px; }
   .rounded-xl { border-radius: 16px; }
   ```

### Шаг 3: Создание компонентов

#### Пример: Кнопка из Figma

**В Figma:**
- Выберите кнопку
- Скопируйте все свойства (Fill, Stroke, Effects, Layout)

**В коде:**
```tsx
// components/Button.tsx (уже существует)
// Обновите стили на основе Figma:

export default function Button({ variant, ...props }) {
  return (
    <button
      className={`btn btn-${variant}`}
      style={{
        // Из Figma: Fill color, border-radius, padding
        backgroundColor: '#ff3333',
        borderRadius: '8px',
        padding: '12px 24px',
        // Из Figma: Typography
        fontSize: '16px',
        fontWeight: 600,
        // Из Figma: Effects (shadows)
        boxShadow: '0 4px 12px rgba(255, 51, 51, 0.3)',
      }}
      {...props}
    />
  )
}
```

### Шаг 4: Структура компонентов

1. **Разбейте дизайн на компоненты:**
   ```
   Страница (Page)
   ├── Header (уже есть PageHeader.tsx)
   ├── Card (уже есть Card.tsx)
   ├── Button (уже есть Button.tsx)
   └── CustomComponent (создайте новый)
   ```

2. **Создайте новый компонент:**
   ```bash
   # Создайте файл компонента
   touch frontend/src/components/YourComponent.tsx
   touch frontend/src/components/YourComponent.css
   ```

### Шаг 5: Адаптивность

```css
/* В Figma: Проверьте Breakpoints (Auto Layout → Responsive) */
/* Используйте медиа-запросы: */

@media (max-width: 768px) {
  .container {
    padding: 12px; /* Меньше отступы на мобильных */
  }
}

@media (min-width: 769px) {
  .container {
    padding: 24px;
  }
}
```

## Автоматизация через плагины

### Использование плагина "Figma to React"

1. Установите плагин в Figma
2. Выберите фрейм/компонент
3. Запустите плагин → выберите "React"
4. Скопируйте код и адаптируйте под ваш проект

### Использование "Copy CSS"

1. Выберите элемент в Figma
2. Правая панель → Code → Copy CSS
3. Вставьте в ваш CSS файл

## Проверка соответствия

### Инструменты для сравнения:

1. **Pixel Perfect:** Плагин Figma для наложения дизайна
2. **Browser DevTools:** Overlay для проверки размеров
3. **Figma Dev Mode:** Режим разработчика в Figma (показывает все стили)

## Рекомендации

1. **Начните с базовых компонентов:**
   - Кнопки
   - Карточки
   - Формы
   - Типографика

2. **Создайте дизайн-систему:**
   ```css
   /* frontend/src/styles/design-tokens.css */
   :root {
     /* Colors */
     --color-primary: #ff3333;
     --color-secondary: #3a3a3a;
     
     /* Spacing */
     --spacing-xs: 4px;
     --spacing-sm: 8px;
     --spacing-md: 16px;
     --spacing-lg: 24px;
     
     /* Typography */
     --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
     --font-size-sm: 12px;
     --font-size-base: 16px;
     --font-size-lg: 20px;
     
     /* Border radius */
     --radius-sm: 4px;
     --radius-md: 8px;
     --radius-lg: 12px;
   }
   ```

3. **Используйте Figma Dev Mode:**
   - Включите Dev Mode в Figma
   - Видите все измерения и стили
   - Копируйте CSS напрямую

## Быстрый старт

1. Откройте Figma файл
2. Выберите фрейм страницы
3. Скопируйте:
   - Цвета → добавьте в CSS переменные
   - Размеры → используйте в стилях
   - Шрифты → добавьте в typography
4. Создайте компоненты на основе существующих (Button, Card, etc.)
5. Адаптируйте стили под вашу структуру

## Пример полного процесса

### Из Figma:
- Кнопка: 12px padding, #ff3333 фон, 8px border-radius, 16px шрифт

### В код:
```tsx
// Обновите Button.tsx
<button
  style={{
    padding: '12px',
    backgroundColor: '#ff3333',
    borderRadius: '8px',
    fontSize: '16px',
  }}
>
```

## Полезные ресурсы

- Figma Community: плагины для экспорта
- Figma Dev Mode: встроенный режим разработчика
- Chrome DevTools: для проверки в браузере
- Figma Desktop App: лучшая производительность для работы

