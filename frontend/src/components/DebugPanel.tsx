import { useEffect, useLayoutEffect, useRef, memo, useState } from 'react'

interface DebugPanelProps {
  debugConfig: any
  setDebugConfig: (config: any) => void
  setDebugMode: (mode: boolean) => void
  debugDice: number[] | null
  setDebugDice: (dice: number[] | null) => void
  containerWidth: number
  isMobile: boolean
  MOBILE_CONFIG: any
  DESKTOP_CONFIG: any
  containerRef?: React.RefObject<HTMLDivElement>
}

const DEBUG_SIZES = [368, 512, 768, 1024, 1440, 1920] as const
type DebugSize = typeof DEBUG_SIZES[number]

const getConfigKey = (size: number) => `backgammon-debug-config-v16-${size}px`

export const DebugPanel = memo(({
  debugConfig,
  setDebugConfig,
  setDebugMode,
  debugDice,
  setDebugDice,
  containerWidth,
  isMobile,
  MOBILE_CONFIG,
  DESKTOP_CONFIG,
  containerRef
}: DebugPanelProps) => {
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [activeCategory, setActiveCategory] = useState<'dice' | 'bearoff' | 'board' | 'text'>('dice')
  const [activeSide, setActiveSide] = useState<'all' | 'white' | 'black'>('all')
  // Инициализируем размер на основе текущей ширины
  const getInitialSize = (): DebugSize => {
    if (containerWidth > 0) {
      const closest = DEBUG_SIZES.reduce((prev, curr) => 
        Math.abs(curr - containerWidth) < Math.abs(prev - containerWidth) ? curr : prev
      )
      return closest
    }
    return 768 // Дефолт если ширина неизвестна
  }
  const [selectedSize, setSelectedSize] = useState<DebugSize>(getInitialSize())
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<number>(0)
  const isScrollingRef = useRef<boolean>(false)
  // Храним актуальный конфиг в ref для сохранения
  const configRef = useRef(debugConfig)
  
  // Обновляем ref при изменении конфига
  useEffect(() => {
    configRef.current = debugConfig
    console.log('📝 Конфиг обновлен в ref:', configRef.current)
  }, [debugConfig])
  
  // Загружаем конфиг для выбранного размера
  const loadConfigForSize = (size: DebugSize) => {
    try {
      const saved = localStorage.getItem(getConfigKey(size))
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.sideMarginLeftPct !== undefined) {
          // Возвращаем сохраненный конфиг как есть - он полный и независимый
          return parsed
        }
      }
    } catch (e) {
      console.warn('Failed to load config for size:', size, e)
    }
    // Если нет сохраненного конфига - используем дефолтный (MOBILE или DESKTOP)
    // Но это только при первом создании, потом каждый размер живет своей жизнью
    return size < 768 ? MOBILE_CONFIG : DESKTOP_CONFIG
  }
  
  // Флаг для отслеживания, был ли конфиг загружен для текущего размера
  const configLoadedForSizeRef = useRef<DebugSize | null>(null)
  
  // При изменении размера загружаем соответствующий конфиг (только при переключении размера)
  useEffect(() => {
    // Загружаем конфиг только если размер изменился
    if (configLoadedForSizeRef.current !== selectedSize) {
      const config = loadConfigForSize(selectedSize)
      setDebugConfig(config)
      configLoadedForSizeRef.current = selectedSize
    }
    
    // Изменяем размер контейнера для тестирования
    if (containerRef?.current) {
      containerRef.current.style.width = `${selectedSize}px`
      containerRef.current.style.maxWidth = `${selectedSize}px`
      containerRef.current.style.margin = '0 auto'
    }
  }, [selectedSize, containerRef])
  
  // Сохраняем позицию скролла при каждом скролле
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const handleScroll = () => {
      if (!isScrollingRef.current) {
        scrollPositionRef.current = container.scrollTop
      }
    }
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])
  
  // Восстанавливаем позицию скролла СИНХРОННО при каждом рендере
  useLayoutEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current
    }
  })

  const handleChange = (key: string, value: number) => {
    console.log(`🔧 Изменение ${key}:`, value, 'Текущий конфиг:', debugConfig)
    setDebugConfig((prev: any) => {
      const updated = { ...prev, [key]: value }
      console.log(`✅ Новый конфиг после изменения ${key}:`, updated)
      return updated
    })
  }
  
  const handleIncrement = (key: string, delta: number) => {
    const currentValue = debugConfig[key]
    const item = [
      { key: 'sideMarginLeftPct', label: 'Side Margin Left', min: 0, max: 2, step: 0.001 },
      { key: 'sideMarginRightPct', label: 'Side Margin Right', min: 0, max: 2, step: 0.001 },
      { key: 'barMarginLeftPct', label: 'Bar Margin Left (Offset)', min: 0, max: 2, step: 0.001 },
      { key: 'barMarginRightPct', label: 'Bar Margin Right (Offset)', min: 0, max: 2, step: 0.001 },
      { key: 'barWidthPct', label: 'Bar Width', min: 0, max: 2, step: 0.001 },
      { key: 'topMarginPct', label: 'Top Margin', min: 0, max: 2, step: 0.001 },
      { key: 'bearOffHeightPct', label: 'BearOff Height', min: 0, max: 2, step: 0.001 },
      { key: 'checkerWidthRatio', label: 'Checker Width Ratio', min: 0.01, max: 20, step: 0.01 },
      { key: 'checkerHeightRatio', label: 'Checker Height Ratio', min: 0.001, max: 5, step: 0.001 },
      { key: 'checkerDrawScale', label: 'Checker Draw Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'diceP1X', label: 'Dice P1 X (0-1)', min: -2, max: 3, step: 0.01 },
      { key: 'diceP1Y', label: 'Dice P1 Y (0-1)', min: -2, max: 3, step: 0.01 },
      { key: 'diceP2X', label: 'Dice P2 X (0-1)', min: -2, max: 3, step: 0.01 },
      { key: 'diceP2Y', label: 'Dice P2 Y (0-1)', min: -2, max: 3, step: 0.01 },
      { key: 'checkerTopOffset', label: 'Top Checker Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'checkerBottomOffset', label: 'Bottom Checker Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'highlightWidthScale', label: 'Highlight Width Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'highlightHeightScale', label: 'Highlight Height Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'highlightXOffset', label: 'Highlight X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'highlightYOffset', label: 'Highlight Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'validHighlightWidthScale', label: 'Valid Highlight Width Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'validHighlightHeightScale', label: 'Valid Highlight Height Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'validHighlightXOffset', label: 'Valid Highlight X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'validHighlightYOffset', label: 'Valid Highlight Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'dragCheckerSizeScale', label: 'Drag Checker Size Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'bearOffCheckerScale', label: 'BearOff Checker Size', min: 0.01, max: 20, step: 0.01 },
      { key: 'bearOffWhiteXOffset', label: 'BearOff White X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffWhiteYOffset', label: 'BearOff White Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffBlackXOffset', label: 'BearOff Black X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffBlackYOffset', label: 'BearOff Black Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'dragCheckerXOffset', label: 'Drag Checker X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'dragCheckerYOffset', label: 'Drag Checker Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffValidWidthScale', label: 'BearOff Valid Width Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'bearOffValidHeightScale', label: 'BearOff Valid Height Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'bearOffValidWhiteXOffset', label: 'BearOff Valid White X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffValidWhiteYOffset', label: 'BearOff Valid White Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffValidBlackXOffset', label: 'BearOff Valid Black X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffValidBlackYOffset', label: 'BearOff Valid Black Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'textTopLeftY', label: 'Text Top Left Y', min: -1000, max: 1000, step: 1 },
      { key: 'textTopRightY', label: 'Text Top Right Y', min: -1000, max: 1000, step: 1 },
      { key: 'textBottomLeftY', label: 'Text Bottom Left Y', min: -1000, max: 1000, step: 1 },
      { key: 'textBottomRightY', label: 'Text Bottom Right Y', min: -1000, max: 1000, step: 1 },
    ].find(i => i.key === key)
    
    if (item) {
      const step = item.step
      const newValue = Math.max(item.min, Math.min(item.max, currentValue + (delta * step)))
      handleChange(key, newValue)
    }
  }

  // Manual scroll buttons handlers
  const scrollUp = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ top: -50, behavior: 'smooth' })
  }
  const scrollDown = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ top: 50, behavior: 'smooth' })
  }

  // Обработчики для перетаскивания
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.debug-panel-header')) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
      e.preventDefault()
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000000,
        background: 'rgba(0,0,0,0.95)',
        color: 'white',
        borderRadius: '10px',
        fontSize: '12px',
        border: '2px solid #555',
        boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
        width: '350px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Заголовок с кнопкой закрытия */}
      <div
        className="debug-panel-header"
        onMouseDown={handleMouseDown}
        style={{
          padding: '10px 15px',
          background: 'rgba(50,50,50,0.9)',
          borderBottom: '1px solid #555',
          borderRadius: '10px 10px 0 0',
          cursor: 'move',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>⚙️ Debug Panel ({isMobile ? 'Mobile' : 'Desktop'})</div>
        <button
          onClick={() => setDebugMode(false)}
          style={{
            background: 'rgba(200,50,50,0.8)',
            border: 'none',
            color: 'white',
            borderRadius: '5px',
            padding: '5px 10px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ✕ Закрыть
        </button>
      </div>

      {/* Контент с прокруткой */}
      <div 
        ref={scrollContainerRef}
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '15px',
          flex: 1,
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '10px', fontSize: '10px', color: '#aaa' }}>
          Current Width: {containerWidth}px
        </div>
        
        {/* Переключатель размеров */}
        <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
            Размер экрана:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {DEBUG_SIZES.map(size => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                style={{
                  fontSize: '11px',
                  padding: '6px 10px',
                  background: selectedSize === size ? '#C93C3D' : '#444',
                  border: selectedSize === size ? '2px solid #fff' : '1px solid #666',
                  color: '#fff',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: selectedSize === size ? 'bold' : 'normal',
                }}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', gap: '5px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => {
              const defaultConfig = selectedSize < 768 ? { ...MOBILE_CONFIG } : { ...DESKTOP_CONFIG }
              setDebugConfig(defaultConfig)
              localStorage.removeItem(getConfigKey(selectedSize))
            }}  
            style={{ fontSize: '12px', padding: '5px 10px', background: '#444', border: '1px solid #666', color: '#fff', cursor: 'pointer', borderRadius: '5px', flex: 1 }}
            title={`Сбросить конфиг для ${selectedSize}px на дефолт`}
          >
            Reset ({selectedSize}px)
          </button>
          <button 
            onClick={() => {
              try {
                // Используем актуальный конфиг из ref
                const configToSave = { ...configRef.current }
                const configKey = getConfigKey(selectedSize)
                console.log(`💾 Сохраняю конфиг для размера ${selectedSize}px:`, configToSave)
                const jsonString = JSON.stringify(configToSave, null, 2)
                localStorage.setItem(configKey, jsonString)
                
                // Проверяем, что сохранилось
                const saved = localStorage.getItem(configKey)
                console.log('✅ Проверка сохранения:', saved ? 'СОХРАНЕНО' : 'НЕ СОХРАНЕНО')
                
                alert(`Конфиг для ${selectedSize}px сохранен!`)
              } catch (e) {
                console.error('❌ Ошибка при сохранении:', e)
                alert('Ошибка при сохранении: ' + e)
              }
            }}  
            style={{ fontSize: '12px', padding: '5px 10px', background: '#4a9', border: '1px solid #6bb', color: '#fff', cursor: 'pointer', borderRadius: '5px', flex: 1 }}
            title={`Сохранить конфиг для ${selectedSize}px`}
          >
            💾 Save ({selectedSize}px)
          </button>
        </div>

        {/* Фильтры категорий */}
        <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
            Категория:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {[
              { id: 'dice', label: '🎲 Кости' },
              { id: 'bearoff', label: '📦 Скид' },
              { id: 'board', label: '🎯 Доска' },
              { id: 'text', label: '🔢 Индексы' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id as any)
                  setActiveSide('all')
                }}
                style={{
                  fontSize: '11px',
                  padding: '6px 10px',
                  background: activeCategory === cat.id ? '#C93C3D' : '#444',
                  border: activeCategory === cat.id ? '2px solid #fff' : '1px solid #666',
                  color: '#fff',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: activeCategory === cat.id ? 'bold' : 'normal',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          
          {/* Фильтр сторон (только для BearOff) */}
          {activeCategory === 'bearoff' && (
            <div>
              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                Сторона:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'white', label: '⚪ Белые' },
                  { id: 'black', label: '⚫ Черные' },
                ].map(side => (
                  <button
                    key={side.id}
                    onClick={() => setActiveSide(side.id as any)}
                    style={{
                      fontSize: '11px',
                      padding: '6px 10px',
                      background: activeSide === side.id ? '#4a9' : '#444',
                      border: activeSide === side.id ? '2px solid #fff' : '1px solid #666',
                      color: '#fff',
                      cursor: 'pointer',
                      borderRadius: '5px',
                      fontWeight: activeSide === side.id ? 'bold' : 'normal',
                    }}
                  >
                    {side.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Определяем параметры по категориям */}
        {(() => {
          const allItems = [
            // Кости
            { key: 'diceP1X', label: 'Dice P1 X (0-1)', min: -2, max: 3, step: 0.01, category: 'dice', side: 'all' },
            { key: 'diceP1Y', label: 'Dice P1 Y (0-1)', min: -2, max: 3, step: 0.01, category: 'dice', side: 'all' },
            { key: 'diceP2X', label: 'Dice P2 X (0-1)', min: -2, max: 3, step: 0.01, category: 'dice', side: 'all' },
            { key: 'diceP2Y', label: 'Dice P2 Y (0-1)', min: -2, max: 3, step: 0.01, category: 'dice', side: 'all' },
            
            // Скид - Общие
            { key: 'bearOffHeightPct', label: 'BearOff Height', min: 0, max: 2, step: 0.001, category: 'bearoff', side: 'all' },
            { key: 'bearOffCheckerScale', label: 'BearOff Checker Size', min: 0.01, max: 20, step: 0.01, category: 'bearoff', side: 'all' },
            { key: 'bearOffValidWidthScale', label: 'BearOff Valid Width Scale', min: 0.01, max: 20, step: 0.01, category: 'bearoff', side: 'all' },
            { key: 'bearOffValidHeightScale', label: 'BearOff Valid Height Scale', min: 0.01, max: 20, step: 0.01, category: 'bearoff', side: 'all' },
            // Скид - Белые
            { key: 'bearOffWhiteXOffset', label: 'BearOff White X Offset (px)', min: -1000, max: 1000, step: 1, category: 'bearoff', side: 'white' },
            { key: 'bearOffWhiteYOffset', label: 'BearOff White Y Offset (px)', min: -1000, max: 1000, step: 1, category: 'bearoff', side: 'white' },
            { key: 'bearOffValidWhiteXOffset', label: 'BearOff Valid White X Offset (px)', min: -1000, max: 1000, step: 1, category: 'bearoff', side: 'white' },
            { key: 'bearOffValidWhiteYOffset', label: 'BearOff Valid White Y Offset (px)', min: -1000, max: 1000, step: 1, category: 'bearoff', side: 'white' },
            // Скид - Черные
            { key: 'bearOffBlackXOffset', label: 'BearOff Black X Offset (px)', min: -1000, max: 1000, step: 1, category: 'bearoff', side: 'black' },
            { key: 'bearOffBlackYOffset', label: 'BearOff Black Y Offset (px)', min: -1000, max: 1000, step: 1, category: 'bearoff', side: 'black' },
            { key: 'bearOffValidBlackXOffset', label: 'BearOff Valid Black X Offset (px)', min: -1000, max: 1000, step: 1, category: 'bearoff', side: 'black' },
            { key: 'bearOffValidBlackYOffset', label: 'BearOff Valid Black Y Offset (px)', min: -1000, max: 1000, step: 1, category: 'bearoff', side: 'black' },
            
            // Доска - Общие
            { key: 'sideMarginLeftPct', label: 'Side Margin Left', min: 0, max: 2, step: 0.001, category: 'board', side: 'all' },
            { key: 'sideMarginRightPct', label: 'Side Margin Right', min: 0, max: 2, step: 0.001, category: 'board', side: 'all' },
            { key: 'barMarginLeftPct', label: 'Bar Margin Left (Offset)', min: 0, max: 2, step: 0.001, category: 'board', side: 'all' },
            { key: 'barMarginRightPct', label: 'Bar Margin Right (Offset)', min: 0, max: 2, step: 0.001, category: 'board', side: 'all' },
            { key: 'barWidthPct', label: 'Bar Width', min: 0, max: 2, step: 0.001, category: 'board', side: 'all' },
            { key: 'topMarginPct', label: 'Top Margin', min: 0, max: 2, step: 0.001, category: 'board', side: 'all' },
            // Доска - Шашки
            { key: 'checkerWidthRatio', label: 'Checker Width Ratio', min: 0.01, max: 20, step: 0.01, category: 'board', side: 'all' },
            { key: 'checkerHeightRatio', label: 'Checker Height Ratio', min: 0.001, max: 5, step: 0.001, category: 'board', side: 'all' },
            { key: 'checkerDrawScale', label: 'Checker Draw Scale', min: 0.01, max: 20, step: 0.01, category: 'board', side: 'all' },
            { key: 'checkerTopOffset', label: 'Top Checker Offset (px)', min: -1000, max: 1000, step: 1, category: 'board', side: 'all' },
            { key: 'checkerBottomOffset', label: 'Bottom Checker Offset (px)', min: -1000, max: 1000, step: 1, category: 'board', side: 'all' },
            // Доска - Подсветка
            { key: 'highlightWidthScale', label: 'Highlight Width Scale', min: 0.01, max: 20, step: 0.01, category: 'board', side: 'all' },
            { key: 'highlightHeightScale', label: 'Highlight Height Scale', min: 0.01, max: 20, step: 0.01, category: 'board', side: 'all' },
            { key: 'highlightXOffset', label: 'Highlight X Offset (px)', min: -1000, max: 1000, step: 1, category: 'board', side: 'all' },
            { key: 'highlightYOffset', label: 'Highlight Y Offset (px)', min: -1000, max: 1000, step: 1, category: 'board', side: 'all' },
            { key: 'validHighlightWidthScale', label: 'Valid Highlight Width Scale', min: 0.01, max: 20, step: 0.01, category: 'board', side: 'all' },
            { key: 'validHighlightHeightScale', label: 'Valid Highlight Height Scale', min: 0.01, max: 20, step: 0.01, category: 'board', side: 'all' },
            { key: 'validHighlightXOffset', label: 'Valid Highlight X Offset (px)', min: -1000, max: 1000, step: 1, category: 'board', side: 'all' },
            { key: 'validHighlightYOffset', label: 'Valid Highlight Y Offset (px)', min: -1000, max: 1000, step: 1, category: 'board', side: 'all' },
            // Доска - Перетаскивание
            { key: 'dragCheckerSizeScale', label: 'Drag Checker Size Scale', min: 0.01, max: 20, step: 0.01, category: 'board', side: 'all' },
            { key: 'dragCheckerXOffset', label: 'Drag Checker X Offset (px)', min: -1000, max: 1000, step: 1, category: 'board', side: 'all' },
            { key: 'dragCheckerYOffset', label: 'Drag Checker Y Offset (px)', min: -1000, max: 1000, step: 1, category: 'board', side: 'all' },
            
            // Индексы
            { key: 'textTopLeftY', label: 'Text Top Left Y', min: -1000, max: 1000, step: 1, category: 'text', side: 'all' },
            { key: 'textTopRightY', label: 'Text Top Right Y', min: -1000, max: 1000, step: 1, category: 'text', side: 'all' },
            { key: 'textBottomLeftY', label: 'Text Bottom Left Y', min: -1000, max: 1000, step: 1, category: 'text', side: 'all' },
            { key: 'textBottomRightY', label: 'Text Bottom Right Y', min: -1000, max: 1000, step: 1, category: 'text', side: 'all' },
          ]
          
          const filteredItems = allItems.filter(item => {
            if (item.category !== activeCategory) return false
            if (activeCategory === 'bearoff' && activeSide !== 'all' && item.side !== activeSide && item.side !== 'all') return false
            return true
          })
          
          return filteredItems.map(item => (
          <div key={item.key} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ flex: 1 }}>{item.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  onClick={() => handleIncrement(item.key, -1)}
                  style={{ fontSize: '14px', padding: '2px 6px', background: '#444', border: '1px solid #666', color: '#fff', cursor: 'pointer', borderRadius: '3px' }}
                  title={`Уменьшить на ${item.step}`}
                >
                  −
                </button>
                <span style={{ minWidth: '80px', textAlign: 'center' }}>{(debugConfig[item.key] ?? 0).toFixed(3)}</span>
                <button
                  onClick={() => handleIncrement(item.key, 1)}
                  style={{ fontSize: '14px', padding: '2px 6px', background: '#444', border: '1px solid #666', color: '#fff', cursor: 'pointer', borderRadius: '3px' }}
                  title={`Увеличить на ${item.step}`}
                >
                  +
                </button>
              </div>
            </div>
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={item.step}
              value={debugConfig[item.key]}
              onChange={(e) => {
                handleChange(item.key, parseFloat(e.target.value))
              }}
              style={{ width: '100%' }}
            />
          </div>
          ))
        })()}
        
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="checkbox" 
                checked={!!debugDice}
                onChange={(e) => setDebugDice(e.target.checked ? [3, 4] : null)}
              />
              <span style={{ marginLeft: '5px' }}>Show Test Dice</span>
            </label>
          </div>

          <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
               onClick={() => {
                 navigator.clipboard.writeText(JSON.stringify(debugConfig, null, 2))
                 alert('Config copied to clipboard!')
               }}
               style={{ fontSize: '12px', padding: '3px 8px', background: '#444', border: '1px solid #666', color: '#fff', cursor: 'pointer', borderRadius: '3px' }}
            >
              Copy Config
            </button>
          </div>

           <textarea 
             readOnly 
             value={JSON.stringify(debugConfig, null, 2)}
             style={{ width: '100%', height: '150px', fontSize: '10px', background: '#222', color: '#ddd', border: '1px solid #555' }}
           />
        </div>
      </div>
    </div>
  )
})
