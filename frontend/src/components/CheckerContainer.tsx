import { useState } from 'react'
import './CheckerContainer.css'

interface CheckerContainerProps {
  onCheckerDrop: (pointIndex: number, checkerColor: 'white' | 'black') => void
  onCheckerRemove: (pointIndex: number) => void
}

export default function CheckerContainer({ onCheckerDrop, onCheckerRemove }: CheckerContainerProps) {
  const [draggedChecker, setDraggedChecker] = useState<'white' | 'black' | null>(null)

  const handleDragStart = (e: React.DragEvent, color: 'white' | 'black') => {
    setDraggedChecker(color)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', color)
  }

  const handleDragEnd = () => {
    setDraggedChecker(null)
  }

  return (
    <div className="checker-container">
      <div className="checker-container-title">Шашки</div>
      <div className="checker-pool">
        <div className="checker-group">
          <div className="checker-group-label">Белые (15)</div>
          <div className="checker-stack white-stack">
            {Array.from({ length: 15 }).map((_, index) => (
              <div
                key={`white-${index}`}
                className="checker checker-white"
                draggable
                onDragStart={(e) => handleDragStart(e, 'white')}
                onDragEnd={handleDragEnd}
                style={{
                  position: 'absolute',
                  left: `${index % 5 * 12}px`,
                  top: `${Math.floor(index / 5) * 12}px`,
                  zIndex: 15 - index,
                }}
              />
            ))}
          </div>
        </div>
        <div className="checker-group">
          <div className="checker-group-label">Черные (15)</div>
          <div className="checker-stack black-stack">
            {Array.from({ length: 15 }).map((_, index) => (
              <div
                key={`black-${index}`}
                className="checker checker-black"
                draggable
                onDragStart={(e) => handleDragStart(e, 'black')}
                onDragEnd={handleDragEnd}
                style={{
                  position: 'absolute',
                  left: `${index % 5 * 12}px`,
                  top: `${Math.floor(index / 5) * 12}px`,
                  zIndex: 15 - index,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="checker-container-hint">
        Перетащите шашку на точку доски для размещения
      </div>
    </div>
  )
}

