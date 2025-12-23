import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Dice3DProps {
  value: number // Значение кубика (1-6) - что должно быть сверху в конце
  textures: { [face: number]: HTMLImageElement } // Текстуры для граней 1-6
  x: number // Позиция X на canvas
  y: number // Позиция Y на canvas
  size: number // Размер кубика
  rolling?: boolean // Анимация падения и вращения
  onAnimationEnd?: () => void // Callback когда анимация завершена
}

// Маппинг: какая текстура (1-6) должна быть на какой грани куба
// Грани BoxGeometry: right (+x), left (-x), top (+y), bottom (-y), front (+z), back (-z)
// Индексы: [right, left, top, bottom, front, back]
const FACE_MAPPING = [3, 4, 2, 5, 1, 6]

// Повороты для каждого значения, чтобы оно было сверху
// Грани: right(3), left(4), top(2), bottom(5), front(1), back(6)
// Чтобы значение было сверху, нужно повернуть куб соответствующим образом
const VALUE_ROTATIONS: { [value: number]: { x: number; y: number; z: number } } = {
  1: { x: -Math.PI / 2, y: 0, z: 0 }, // front -> top
  2: { x: 0, y: 0, z: 0 }, // top уже сверху
  3: { x: 0, y: -Math.PI / 2, z: 0 }, // right -> top
  4: { x: 0, y: Math.PI / 2, z: 0 }, // left -> top
  5: { x: Math.PI / 2, y: 0, z: 0 }, // bottom -> top
  6: { x: 0, y: Math.PI, z: 0 }, // back -> top (поворот на 180 по Y)
}

export default function Dice3D({
  value,
  textures,
  x,
  y,
  size,
  rolling = false,
  onAnimationEnd,
}: Dice3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cubeRef = useRef<THREE.Mesh | null>(null)
  const animationFrameRef = useRef<number>()
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([])
  
  // Физика кубика
  const physicsRef = useRef<{
    positionY: number
    velocityY: number
    rotationX: number
    rotationY: number
    rotationZ: number
    rotationVelX: number
    rotationVelY: number
    rotationVelZ: number
    bounceCount: number
    phase: 'falling' | 'bouncing' | 'settling'
  }>({
    positionY: 3, // Начинаем сверху
    velocityY: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    rotationVelX: (Math.random() - 0.5) * 0.3,
    rotationVelY: (Math.random() - 0.5) * 0.3,
    rotationVelZ: (Math.random() - 0.5) * 0.3,
    bounceCount: 0,
    phase: 'falling',
  })
  
  const [isAnimating, setIsAnimating] = useState(rolling)

  useEffect(() => {
    if (!containerRef.current || !textures || Object.keys(textures).length === 0) return

    // Очищаем предыдущий контент
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild)
    }

    // Создаем сцену
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Создаем камеру (смотрим сверху-сбоку, как в Монополии)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
    camera.position.set(2, 3, 5)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Создаем рендерер
    const canvas = document.createElement('canvas')
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      canvas: canvas
    })
    renderer.setSize(size, size)
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(canvas)
    rendererRef.current = renderer

    // Создаем куб
    const geometry = new THREE.BoxGeometry(2, 2, 2)

    // Создаем материалы для каждой грани
    const materials: THREE.MeshBasicMaterial[] = []
    materialsRef.current = materials

    for (let i = 0; i < 6; i++) {
      const faceValue = FACE_MAPPING[i]
      const textureImage = textures[faceValue]
      
      if (textureImage) {
        const texture = new THREE.Texture(textureImage)
        texture.needsUpdate = true
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
        materials.push(material)
      } else {
        // Fallback: белый материал с цифрой
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 256, 256)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 4
        ctx.strokeRect(0, 0, 256, 256)
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 180px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(faceValue.toString(), 128, 128)
        
        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true
        materials.push(new THREE.MeshBasicMaterial({ map: texture }))
      }
    }

    const cube = new THREE.Mesh(geometry, materials)
    cube.position.set(0, 0, 0)
    scene.add(cube)
    cubeRef.current = cube

    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    // Инициализация физики при начале анимации
    if (rolling) {
      physicsRef.current = {
        positionY: 4, // Высоко начинаем
        velocityY: 0,
        rotationX: Math.random() * Math.PI * 2,
        rotationY: Math.random() * Math.PI * 2,
        rotationZ: Math.random() * Math.PI * 2,
        rotationVelX: (Math.random() - 0.5) * 0.4,
        rotationVelY: (Math.random() - 0.5) * 0.4,
        rotationVelZ: (Math.random() - 0.5) * 0.4,
        bounceCount: 0,
        phase: 'falling',
      }
      setIsAnimating(true)
    }

    let animationStartTime = Date.now()
    const GRAVITY = -0.015
    const BOUNCE_DAMPING = 0.6
    const GROUND_Y = 0
    const MAX_BOUNCES = 3

    // Функция анимации
    const animate = () => {
      if (!cubeRef.current || !sceneRef.current || !cameraRef.current || !rendererRef.current) return

      const elapsed = Date.now() - animationStartTime

      if (rolling && isAnimating) {
        const physics = physicsRef.current
        
        if (physics.phase === 'falling') {
          // Падение с гравитацией
          physics.velocityY += GRAVITY
          physics.positionY += physics.velocityY
          
          // Вращение при падении
          physics.rotationX += physics.rotationVelX
          physics.rotationY += physics.rotationVelY
          physics.rotationZ += physics.rotationVelZ
          
          // Применяем к кубу
          cubeRef.current.position.y = physics.positionY
          cubeRef.current.rotation.x = physics.rotationX
          cubeRef.current.rotation.y = physics.rotationY
          cubeRef.current.rotation.z = physics.rotationZ
          
          // Проверяем столкновение с землей
          if (physics.positionY <= GROUND_Y) {
            physics.positionY = GROUND_Y
            if (physics.bounceCount < MAX_BOUNCES && Math.abs(physics.velocityY) > 0.1) {
              // Отскок
              physics.velocityY = -physics.velocityY * BOUNCE_DAMPING
              physics.rotationVelX *= 0.8
              physics.rotationVelY *= 0.8
              physics.rotationVelZ *= 0.8
              physics.bounceCount++
              physics.phase = 'bouncing'
            } else {
              // Останавливаемся
              physics.velocityY = 0
              physics.phase = 'settling'
              physics.rotationVelX = 0
              physics.rotationVelY = 0
              physics.rotationVelZ = 0
            }
          }
        } else if (physics.phase === 'bouncing') {
          // Продолжаем падение после отскока
          physics.velocityY += GRAVITY
          physics.positionY += physics.velocityY
          
          physics.rotationX += physics.rotationVelX
          physics.rotationY += physics.rotationVelY
          physics.rotationZ += physics.rotationVelZ
          
          cubeRef.current.position.y = physics.positionY
          cubeRef.current.rotation.x = physics.rotationX
          cubeRef.current.rotation.y = physics.rotationY
          cubeRef.current.rotation.z = physics.rotationZ
          
          if (physics.positionY <= GROUND_Y) {
            physics.positionY = GROUND_Y
            if (physics.bounceCount < MAX_BOUNCES && Math.abs(physics.velocityY) > 0.1) {
              physics.velocityY = -physics.velocityY * BOUNCE_DAMPING
              physics.rotationVelX *= 0.8
              physics.rotationVelY *= 0.8
              physics.rotationVelZ *= 0.8
              physics.bounceCount++
            } else {
              physics.velocityY = 0
              physics.phase = 'settling'
              physics.rotationVelX = 0
              physics.rotationVelY = 0
              physics.rotationVelZ = 0
            }
          }
        } else if (physics.phase === 'settling') {
          // Выравниваем кубик, чтобы нужное значение было сверху
          const targetRotation = VALUE_ROTATIONS[value] || { x: 0, y: 0, z: 0 }
          
          const currentRot = cubeRef.current.rotation
          const targetX = targetRotation.x
          const targetY = targetRotation.y
          const targetZ = targetRotation.z
          
          // Плавная интерполяция к целевому повороту
          const lerpSpeed = 0.1
          currentRot.x = THREE.MathUtils.lerp(currentRot.x, targetX, lerpSpeed)
          currentRot.y = THREE.MathUtils.lerp(currentRot.y, targetY, lerpSpeed)
          currentRot.z = THREE.MathUtils.lerp(currentRot.z, targetZ, lerpSpeed)
          
          cubeRef.current.rotation.copy(currentRot)
          
          // Проверяем, достаточно ли близко к целевому повороту
          const distX = Math.abs(currentRot.x - targetX)
          const distY = Math.abs(currentRot.y - targetY)
          const distZ = Math.abs(currentRot.z - targetZ)
          
          if (distX < 0.01 && distY < 0.01 && distZ < 0.01 && elapsed > 2000) {
            // Финальная установка точных значений
            cubeRef.current.rotation.set(targetX, targetY, targetZ)
            setIsAnimating(false)
            if (onAnimationEnd) {
              setTimeout(() => onAnimationEnd(), 100)
            }
          }
        }
        
        // Автоматическое завершение после максимума времени
        if (elapsed > 3000) {
          setIsAnimating(false)
          const targetRotation = VALUE_ROTATIONS[value] || { x: 0, y: 0, z: 0 }
          cubeRef.current.rotation.set(targetRotation.x, targetRotation.y, targetRotation.z)
          cubeRef.current.position.y = GROUND_Y
          if (onAnimationEnd) {
            setTimeout(() => onAnimationEnd(), 100)
          }
        }
      } else if (!rolling) {
        // Если не rolling, просто показываем финальное значение
        const targetRotation = VALUE_ROTATIONS[value] || { x: 0, y: 0, z: 0 }
        cubeRef.current.rotation.set(targetRotation.x, targetRotation.y, targetRotation.z)
        cubeRef.current.position.y = GROUND_Y
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
      geometry.dispose()
      materialsRef.current.forEach(mat => {
        if (mat.map) mat.map.dispose()
        mat.dispose()
      })
      materialsRef.current = []
    }
  }, [textures, size, rolling, value, onAnimationEnd])

  useEffect(() => {
    if (rolling && !isAnimating) {
      setIsAnimating(true)
      physicsRef.current = {
        positionY: 4,
        velocityY: 0,
        rotationX: Math.random() * Math.PI * 2,
        rotationY: Math.random() * Math.PI * 2,
        rotationZ: Math.random() * Math.PI * 2,
        rotationVelX: (Math.random() - 0.5) * 0.4,
        rotationVelY: (Math.random() - 0.5) * 0.4,
        rotationVelZ: (Math.random() - 0.5) * 0.4,
        bounceCount: 0,
        phase: 'falling',
      }
    }
  }, [rolling, isAnimating])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${size}px`,
    height: `${size}px`,
    pointerEvents: 'none',
    zIndex: 1000,
    overflow: 'hidden',
  }

  return <div ref={containerRef} style={style} />
}
