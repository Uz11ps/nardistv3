import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Dice3DProps {
  value: number // Значение кубика (1-6) - используется только после остановки
  textures: { [face: number]: HTMLImageElement } // Текстуры для граней 1-6
  x: number // Позиция X на canvas
  y: number // Позиция Y на canvas
  size: number // Размер кубика
  rolling?: boolean // Анимация вращения
  onAnimationEnd?: () => void // Callback когда анимация завершена
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
  const rotationVelocityRef = useRef({ x: 0, y: 0, z: 0 })
  const [isAnimating, setIsAnimating] = useState(rolling)
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([])

  useEffect(() => {
    if (!containerRef.current || !textures || Object.keys(textures).length === 0) return

    // Очищаем предыдущий контент
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild)
    }

    // Создаем сцену
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Создаем камеру
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
    camera.position.set(0, 0, 5)
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
    renderer.setClearColor(0x000000, 0) // Прозрачный фон
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(canvas)
    rendererRef.current = renderer

    // Создаем куб
    const geometry = new THREE.BoxGeometry(2, 2, 2)

    // Создаем материалы для каждой грани
    // Порядок граней в BoxGeometry: right (+x), left (-x), top (+y), bottom (-y), front (+z), back (-z)
    // Маппинг для стандартного кубика (чтобы значения отображались правильно):
    // 1 - front, 2 - top, 3 - right, 4 - left, 5 - bottom, 6 - back
    const faceMapping = [3, 4, 2, 5, 1, 6] // right, left, top, bottom, front, back

    const materials: THREE.MeshBasicMaterial[] = []
    materialsRef.current = materials

    for (let i = 0; i < 6; i++) {
      const faceValue = faceMapping[i]
      const textureImage = textures[faceValue]
      
      if (textureImage) {
        const texture = new THREE.CanvasTexture(textureImage)
        texture.needsUpdate = true
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
        materials.push(material)
      } else {
        // Если текстура отсутствует, используем белый материал с цифрой
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 256, 256)
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

    // Добавляем освещение для лучшего вида
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    // Начальная скорость вращения при броске
    if (rolling) {
      rotationVelocityRef.current = {
        x: (Math.random() - 0.5) * 0.4,
        y: (Math.random() - 0.5) * 0.4,
        z: (Math.random() - 0.5) * 0.4,
      }
      setIsAnimating(true)
    }

    let animationStartTime = Date.now()
    const animationDuration = 1500 // 1.5 секунды анимации

    // Функция анимации
    const animate = () => {
      if (!cubeRef.current || !sceneRef.current || !cameraRef.current || !rendererRef.current) return

      const elapsed = Date.now() - animationStartTime

      if (rolling && isAnimating && elapsed < animationDuration) {
        // Применяем вращение
        cubeRef.current.rotation.x += rotationVelocityRef.current.x
        cubeRef.current.rotation.y += rotationVelocityRef.current.y
        cubeRef.current.rotation.z += rotationVelocityRef.current.z

        // Замедляем вращение по времени
        const progress = elapsed / animationDuration
        const slowdown = 1 - progress * 0.98 // Плавное замедление
        rotationVelocityRef.current.x *= slowdown
        rotationVelocityRef.current.y *= slowdown
        rotationVelocityRef.current.z *= slowdown
      } else if (isAnimating && elapsed >= animationDuration) {
        // Останавливаем анимацию
        setIsAnimating(false)
        if (onAnimationEnd) {
          setTimeout(() => onAnimationEnd(), 100)
        }
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
  }, [textures, size, rolling, onAnimationEnd])

  useEffect(() => {
    if (rolling && !isAnimating) {
      setIsAnimating(true)
      rotationVelocityRef.current = {
        x: (Math.random() - 0.5) * 0.4,
        y: (Math.random() - 0.5) * 0.4,
        z: (Math.random() - 0.5) * 0.4,
      }
    }
  }, [rolling, isAnimating])

  // Позиционируем контейнер абсолютно поверх canvas
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

