# Быстрый старт: Перевод Figma → Код

## 🚀 Простой способ (5 минут)

### 1. Откройте Figma Dev Mode
- Включите "Dev Mode" в правом верхнем углу
- Видите все CSS свойства элементов

### 2. Скопируйте стили элемента:

**Пример: Кнопка из Figma**
```
В Figma: Кнопка с:
- Background: #ff3333
- Padding: 12px 24px
- Border radius: 8px
- Font: 16px, weight 600
- Shadow: 0 4px 12px rgba(255, 51, 51, 0.3)
```

**В код (Button.tsx):**
```tsx
<button
  style={{
    backgroundColor: '#ff3333',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    boxShadow: '0 4px 12px rgba(255, 51, 51, 0.3)',
  }}
>
```

### 3. Используйте CSS переменные

Обновите `frontend/src/styles/figma-tokens.css` со значениями из Figma, затем используйте:

```tsx
<button style={{ backgroundColor: 'var(--color-primary)' }}>
```

## 📋 Чеклист для каждой страницы

- [ ] Цвета → `figma-tokens.css`
- [ ] Шрифты → `figma-tokens.css`
- [ ] Отступы → компоненты
- [ ] Размеры → компоненты
- [ ] Тени/эффекты → `figma-tokens.css`
- [ ] Иконки → экспорт в `public/` или `src/assets/`
- [ ] Изображения → экспорт в `public/` или `src/assets/`

## 🛠 Инструменты

1. **Figma Dev Mode** - показывает все CSS
2. **Плагин "Copy CSS"** - копирует стили
3. **Chrome DevTools** - проверка в браузере

## 💡 Пример полного процесса

1. **Выберите страницу в Figma**
2. **Скопируйте цвета** → добавьте в `figma-tokens.css`
3. **Скопируйте размеры** → используйте в компонентах
4. **Экспортируйте изображения** → в `public/`
5. **Создайте/обновите компонент** → используйте существующие (Button, Card, etc.)
6. **Проверьте в браузере** → сравните с Figma

## ⚡ Автоматизация

Если у вас есть доступ к Figma API или плагинам:
- Используйте плагины для экспорта компонентов
- Адаптируйте сгенерированный код под ваш проект

## 📱 Адаптивность

Из Figma: Проверьте Auto Layout → Responsive
В коде: Используйте медиа-запросы из `figma-tokens.css`

```css
@media (max-width: 768px) {
  .component {
    padding: var(--spacing-2); /* Меньше отступы на мобильных */
  }
}
```

