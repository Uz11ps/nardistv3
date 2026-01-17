import { useEffect, useLayoutEffect, useRef, memo } from 'react'

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
}

export const DebugPanel = memo(({
  debugConfig,
  setDebugConfig,
  setDebugMode,
  debugDice,
  setDebugDice,
  containerWidth,
  isMobile,
  MOBILE_CONFIG,
  DESKTOP_CONFIG
}: DebugPanelProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<number>(0)
  const isScrollingRef = useRef<boolean>(false)
  
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
    // Просто изменяем состояние - контейнер скролла не пересоздается благодаря тому что компонент вынесен
    setDebugConfig((prev: any) => ({ ...prev, [key]: value }))
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
      { key: 'bearOffXOffset', label: 'BearOff X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffYOffset', label: 'BearOff Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffValidWidthScale', label: 'BearOff Valid Width Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'bearOffValidHeightScale', label: 'BearOff Valid Height Scale', min: 0.01, max: 20, step: 0.01 },
      { key: 'bearOffValidXOffset', label: 'BearOff Valid X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'bearOffValidYOffset', label: 'BearOff Valid Y Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'dragCheckerXOffset', label: 'Drag Checker X Offset (px)', min: -1000, max: 1000, step: 1 },
      { key: 'dragCheckerYOffset', label: 'Drag Checker Y Offset (px)', min: -1000, max: 1000, step: 1 },
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

  return (
    <div 
      ref={scrollContainerRef}
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 100000,
        background: 'rgba(0,0,0,0.85)',
        color: 'white',
        padding: '15px',
        borderRadius: '10px',
        fontSize: '12px',
        maxHeight: '80vh',
        height: '80vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        border: '1px solid #444',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
        width: '300px',
        pointerEvents: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10, paddingBottom: '5px' }}>
        <h3 style={{ margin: 0 }}>Debug v14 ({isMobile ? 'Mobile' : 'Desktop'})</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
           <button 
             onClick={() => {
               const defaultConfig = isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG
               setDebugConfig(defaultConfig)
               localStorage.removeItem('backgammon-debug-config-v14')
             }}  
             style={{ fontSize: '12px', padding: '3px 6px', background: '#444', border: '1px solid #666', color: '#fff', cursor: 'pointer', borderRadius: '3px' }}
             title="Сбросить на дефолт"
           >
             Reset
           </button>
           <button onClick={scrollUp} style={{ fontSize: '16px', padding: '5px' }}>⬆️</button>
           <button onClick={scrollDown} style={{ fontSize: '16px', padding: '5px' }}>⬇️</button>
           <button onClick={() => setDebugMode(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      </div>
      
      <div style={{ marginBottom: '10px', fontSize: '10px', color: '#aaa' }}>
          Current Width: {containerWidth}px
      </div>
      
      {[
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
        { key: 'bearOffXOffset', label: 'BearOff X Offset (px)', min: -1000, max: 1000, step: 1 },
        { key: 'bearOffYOffset', label: 'BearOff Y Offset (px)', min: -1000, max: 1000, step: 1 },
        { key: 'dragCheckerXOffset', label: 'Drag Checker X Offset (px)', min: -1000, max: 1000, step: 1 },
        { key: 'dragCheckerYOffset', label: 'Drag Checker Y Offset (px)', min: -1000, max: 1000, step: 1 },
        { key: 'textTopLeftY', label: 'Text Top Left Y', min: -1000, max: 1000, step: 1 },
        { key: 'textTopRightY', label: 'Text Top Right Y', min: -1000, max: 1000, step: 1 },
        { key: 'textBottomLeftY', label: 'Text Bottom Left Y', min: -1000, max: 1000, step: 1 },
        { key: 'textBottomRightY', label: 'Text Bottom Right Y', min: -1000, max: 1000, step: 1 },
      ].map(item => (
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
              <span style={{ minWidth: '80px', textAlign: 'center' }}>{debugConfig[item.key].toFixed(3)}</span>
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
      ))}
      
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
  )
})
