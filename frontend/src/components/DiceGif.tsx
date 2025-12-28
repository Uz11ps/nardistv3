import React from 'react';

interface DiceGifProps {
  dice: number[];
  usedDiceIndices: Set<number>;
  animating: boolean;
  size?: number;
}

const DiceGif: React.FC<DiceGifProps> = ({ dice, usedDiceIndices, animating, size = 50 }) => {
  if (!dice || dice.length < 2) return null;

  // В нардах всегда бросаются две кости. Если дубль, то dice.length === 4.
  // Нам нужны первые два значения для определения имени гифки.
  const d1 = dice[0];
  const d2 = dice[1];
  
  // Формируем путь к гифке. Учитываем, что у нас есть и 1_2.gif и 2_1.gif
  const gifName = `${d1}_${d2}.gif`;
  const gifPath = `/img/cubiki/${gifName}`;

  const isDoubles = dice.length > 2;
  const totalDice = dice.length;
  const usedCount = usedDiceIndices.size;
  const remainingCount = totalDice - usedCount;

  // Если все кубики использованы, ничего не показываем
  if (remainingCount === 0) return null;

  // Стиль контейнера
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: size * 2.5,
    height: size * 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // Если один из кубиков (не дубль) использован, 
  // мы не можем показать это на одной гифке, где два кубика.
  // В этом случае возвращаем null, чтобы BackgammonBoard показал обычные Dice3D.
  if (!isDoubles && usedCount > 0) {
    return null;
  }

  return (
    <div className="dice-gif-wrapper" style={containerStyle}>
      <img 
        src={gifPath} 
        alt={`Dice ${d1} ${d2}`} 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
        }} 
      />
      
      {isDoubles && remainingCount > 0 && (
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

