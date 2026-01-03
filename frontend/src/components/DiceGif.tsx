import React from 'react';

interface DiceGifProps {
  dice: number[];
  usedDiceIndices: Set<number>;
  animating: boolean;
  size?: number;
}

// Глобальный Set для отслеживания активных анимаций (работает даже при перемонтировании компонента)
const activeAnimations = new Set<string>();

const DiceGif: React.FC<DiceGifProps> = ({ dice, usedDiceIndices, animating, size = 50 }) => {
  const [gifKey, setGifKey] = React.useState(Date.now());
  const prevAnimatingRef = React.useRef(false);
  const isAnimatingRef = React.useRef(false);
  const lastDiceRef = React.useRef<string>('');
  const gifStartedRef = React.useRef(false);
  const componentIdRef = React.useRef<string>(`dicegif_${Date.now()}_${Math.random()}`);

  // Перезапускаем гифку только при переходе из неактивного состояния в активное
  // И только если кубики действительно изменились
  React.useEffect(() => {
    const diceKey = dice ? dice.join(',') : '';
    const animationId = `${diceKey}_${componentIdRef.current}`;
    
    // СТРОГАЯ защита: проверяем глобальный Set активных анимаций
    if (activeAnimations.has(animationId)) {
      console.log('🎬 DiceGif: Animation already active globally, skipping');
      return;
    }
    
    // СТРОГАЯ защита: если анимация уже идет локально, НИКОГДА не перезапускаем
    if (isAnimatingRef.current) {
      console.log('🎬 DiceGif: Animation already in progress locally, skipping all restarts');
      return;
    }
    
    // Если GIF уже запущен с теми же кубиками и анимация активна, не перезапускаем
    if (gifStartedRef.current && lastDiceRef.current === diceKey && animating) {
      console.log('🎬 DiceGif: GIF already started with same dice, skipping');
      return;
    }
    
    // Только при переходе с false на true - перезапускаем GIF
    if (animating && !prevAnimatingRef.current) {
      const newGifKey = Date.now();
      console.log('🎬 DiceGif: Starting animation, diceKey:', diceKey, 'gifKey:', newGifKey, 'animationId:', animationId);
      
      // Добавляем в глобальный Set СРАЗУ
      activeAnimations.add(animationId);
      isAnimatingRef.current = true;
      gifStartedRef.current = true;
      lastDiceRef.current = diceKey;
      
      // СРАЗУ обновляем ключ, чтобы гифка перезапустилась
      setGifKey(newGifKey);
    }
    
    if (!animating && prevAnimatingRef.current) {
      // Когда анимация завершается (переход с true на false), сбрасываем флаги с задержкой
      isAnimatingRef.current = false;
      activeAnimations.delete(animationId);
      setTimeout(() => {
        gifStartedRef.current = false;
        console.log('🎬 DiceGif: Animation finished, flags reset');
      }, 500); // Увеличиваем задержку до 500мс для надежности
    }
    
    prevAnimatingRef.current = animating;
    
    // Cleanup при размонтировании
    return () => {
      activeAnimations.delete(animationId);
    };
  }, [animating, dice]); // Убрали gifKey из зависимостей, чтобы избежать повторных запусков

  if (!dice || dice.length < 2) return null;

  const d1 = dice[0];
  const d2 = dice[1];
  
  // Добавляем timestamp к пути, чтобы гифка проигралась с начала (даже если она зациклена в файле, 
  // это гарантирует старт с 1 кадра при каждом броске)
  const gifName = `${d1}_${d2}.gif`;
  const gifPath = `/img/cubiki/${gifName}?t=${gifKey}`;

  const isDoubles = dice.length > 2;
  const totalDice = dice.length;
  const usedCount = usedDiceIndices.size;
  const remainingCount = totalDice - usedCount;

  // Увеличиваем размер в 3 раза (было 2.5 и 1.5, стало 7.5 и 4.5)
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: size * 7.5,
    height: size * 4.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  };

  if (remainingCount === 0) return null;

  return (
    <div 
      className="dice-gif-wrapper" 
      style={{
        ...containerStyle,
        opacity: animating ? 1 : 0,
        visibility: animating ? 'visible' : 'hidden',
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      {animating && (
        <img 
          key={`${d1}_${d2}_${gifKey}`}
          src={gifPath} 
          alt={`Dice ${d1} ${d2}`} 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
          }} 
        />
      )}
      
      {isDoubles && remainingCount > 0 && animating && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          right: '-10px',
          background: 'rgba(232, 65, 66, 0.9)',
          color: 'white',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          zIndex: 10
        }}>
          x{remainingCount}
        </div>
      )}
    </div>
  );
};

export default DiceGif;

