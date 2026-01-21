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
  const lastDiceKeyRef = React.useRef<string>('');
  const animationStartedRef = React.useRef(false);
  const componentIdRef = React.useRef<string>(`dicegif_${Date.now()}_${Math.random()}`);

  // Упрощенная логика: анимация запускается только один раз при переходе animating с false на true
  // И только если кубики действительно изменились (первые два значения)
  React.useEffect(() => {
    if (!dice || dice.length < 2) {
      // Если кубиков нет, сбрасываем состояние только если анимация была активна
      if (prevAnimatingRef.current && !animating) {
        animationStartedRef.current = false;
        lastDiceKeyRef.current = '';
      }
      prevAnimatingRef.current = animating;
      return;
    }

    // Для идентификации броска используем ТОЛЬКО первые два значения (для дублей это критично)
    // Это гарантирует, что один и тот же бросок не запустит анимацию дважды
    const diceKeyForAnimation = `${dice[0]},${dice[1]}`;
    const animationId = `${diceKeyForAnimation}_${componentIdRef.current}`;
    
    // ВАЖНО: Анимация запускается ТОЛЬКО при переходе animating с false на true
    // И только если это новый бросок (первые два значения кубиков изменились)
    const isNewAnimation = animating && !prevAnimatingRef.current;
    const diceChanged = lastDiceKeyRef.current !== diceKeyForAnimation;
    
    if (isNewAnimation && diceChanged) {
      // Проверяем глобальный Set - если анимация уже идет для этих кубиков, пропускаем
      if (activeAnimations.has(animationId)) {
        console.log('🎬 DiceGif: Animation already active globally for this dice, skipping');
        prevAnimatingRef.current = animating;
        return;
      }
      
      // Проверяем локальный флаг - если анимация уже запущена, не запускаем повторно
      if (animationStartedRef.current) {
        console.log('🎬 DiceGif: Animation already started locally, skipping');
        prevAnimatingRef.current = animating;
        return;
      }
      
      const newGifKey = Date.now();
      console.log('🎬 DiceGif: Starting NEW animation, diceKey:', diceKeyForAnimation, 'gifKey:', newGifKey);
      
      // Помечаем анимацию как запущенную СРАЗУ
      activeAnimations.add(animationId);
      animationStartedRef.current = true;
      lastDiceKeyRef.current = diceKeyForAnimation;
      
      // Обновляем ключ для перезапуска гифки
      setGifKey(newGifKey);
    }
    
    // ВАЖНО: Если анимация уже идет (animating = true), НЕ реагируем на изменения dice
    // Это предотвращает перезапуск анимации при использовании кубиков в дублях
    if (animating && prevAnimatingRef.current && diceChanged) {
      console.log('🎬 DiceGif: Animation in progress, ignoring dice changes');
      prevAnimatingRef.current = animating;
      return;
    }
    
    // Когда анимация завершается (переход с true на false), полностью очищаем состояние
    if (!animating && prevAnimatingRef.current) {
      console.log('🎬 DiceGif: Animation finished, cleaning up');
      activeAnimations.delete(animationId);
      
      // Сбрасываем флаги после небольшой задержки для надежности
      setTimeout(() => {
        animationStartedRef.current = false;
        lastDiceKeyRef.current = '';
      }, 300);
    }
    
    prevAnimatingRef.current = animating;
    
    // Cleanup при размонтировании
    return () => {
      activeAnimations.delete(animationId);
    };
  }, [animating, dice]); // dice в зависимостях нужен для проверки изменения первых двух значений

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
      borderRadius: '12px', // Match Dice3D border radius
      overflow: 'hidden',   // Clip corners to make it rounded
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

