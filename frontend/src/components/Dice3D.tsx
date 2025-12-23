import { useEffect, useRef } from 'react'
import './Dice3D.css'

interface Dice3DProps {
  values: number[]
  animating?: boolean
  diceTextures?: { [face: number]: HTMLImageElement }
}

export default function Dice3D({ values, animating = false, diceTextures }: Dice3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="dice3d-container">
      {values.map((value, index) => (
        <div
          key={index}
          className={`dice3d ${animating ? 'dice3d-animating' : ''}`}
        >
          {diceTextures && diceTextures[value] ? (
            <img
              src={diceTextures[value].src}
              alt={`Dice ${value}`}
              className="dice3d-texture"
            />
          ) : (
            <div className="dice3d-face">
              <div className="dice3d-dots">
                {getDots(value).map((dot, dotIndex) => (
                  <div
                    key={dotIndex}
                    className="dice3d-dot"
                    style={{
                      gridRow: Math.floor(dot / 3) + 1,
                      gridColumn: (dot % 3) + 1,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function getDots(value: number): number[] {
  const patterns: { [key: number]: number[] } = {
    1: [4], // Центр
    2: [0, 8], // Диагональ
    3: [0, 4, 8], // Диагональ все три
    4: [0, 2, 6, 8], // Углы
    5: [0, 2, 4, 6, 8], // Углы + центр
    6: [0, 1, 2, 6, 7, 8], // Две колонки
  }
  return patterns[value] || []
}

