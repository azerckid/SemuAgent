'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PARTICLE_COUNT = 120
const CONNECTION_DISTANCE = 2.8
const MOUSE_DISTANCE = 3.4
const COLD = new THREE.Color('#94a3b8')
const WARM = new THREE.Color('#f97316')

interface ParticleConfig {
  basePos: THREE.Vector3
  speed: number
  phaseX: number
  phaseY: number
  phaseZ: number
}

function createParticleTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64

  const context = canvas.getContext('2d')
  if (!context) return undefined

  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.6)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)

  return new THREE.CanvasTexture(canvas)
}

export function PublicLandingHouseScene() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.z = 16

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)

    const configs: ParticleConfig[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      basePos: new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 13,
        (Math.random() - 0.5) * 5,
      ),
      speed: 0.06 + Math.random() * 0.12,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2,
    }))

    const particlePositions = new Float32Array(PARTICLE_COUNT * 3)
    const particleColors = new Float32Array(PARTICLE_COUNT * 3)
    configs.forEach((config, index) => {
      particlePositions[index * 3] = config.basePos.x
      particlePositions[index * 3 + 1] = config.basePos.y
      particlePositions[index * 3 + 2] = config.basePos.z
      particleColors[index * 3] = COLD.r
      particleColors[index * 3 + 1] = COLD.g
      particleColors[index * 3 + 2] = COLD.b
    })

    const particlePositionAttribute = new THREE.BufferAttribute(particlePositions, 3)
    const particleColorAttribute = new THREE.BufferAttribute(particleColors, 3)
    particlePositionAttribute.setUsage(THREE.DynamicDrawUsage)
    particleColorAttribute.setUsage(THREE.DynamicDrawUsage)

    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', particlePositionAttribute)
    particleGeometry.setAttribute('color', particleColorAttribute)

    const particleTexture = createParticleTexture()
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.22,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      map: particleTexture,
      depthWrite: false,
      alphaTest: 0.01,
    })
    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

    const maxSegments = 700
    const linePositions = new Float32Array(maxSegments * 6)
    const lineColors = new Float32Array(maxSegments * 6)
    const linePositionAttribute = new THREE.BufferAttribute(linePositions, 3)
    const lineColorAttribute = new THREE.BufferAttribute(lineColors, 3)
    linePositionAttribute.setUsage(THREE.DynamicDrawUsage)
    lineColorAttribute.setUsage(THREE.DynamicDrawUsage)

    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', linePositionAttribute)
    lineGeometry.setAttribute('color', lineColorAttribute)
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    })
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lines)

    const currentPositions = configs.map((config) => config.basePos.clone())
    const offsets = Array.from({ length: PARTICLE_COUNT }, () => new THREE.Vector3())
    const warmth = new Float32Array(PARTICLE_COUNT)
    const mouseNdc = new THREE.Vector2(999, 999)
    const mouseWorld = new THREE.Vector3(9999, 9999, 0)
    const raycaster = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const tempVector = new THREE.Vector3()
    const tempColor = new THREE.Color()

    const resize = () => {
      const width = Math.max(container.clientWidth, 1)
      const height = Math.max(container.clientHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const resetPointer = () => {
      mouseNdc.set(999, 999)
      mouseWorld.set(9999, 9999, 0)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const isInsideScene =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom

      if (!isInsideScene) {
        resetPointer()
        return
      }

      mouseNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseNdc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    }

    const handlePointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) resetPointer()
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerout', handlePointerOut)
    window.addEventListener('blur', resetPointer)

    const clock = new THREE.Clock()
    let animationFrameId = 0

    const animate = () => {
      const time = clock.getElapsedTime()

      if (mouseNdc.x < 900) {
        raycaster.setFromCamera(mouseNdc, camera)
        raycaster.ray.intersectPlane(plane, mouseWorld)
      }

      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const config = configs[index]
        const offset = offsets[index]

        const floatX = config.basePos.x + Math.sin(time * config.speed + config.phaseX) * 0.6
        const floatY = config.basePos.y + Math.cos(time * config.speed * 0.8 + config.phaseY) * 0.4
        const floatZ = config.basePos.z + Math.sin(time * config.speed * 0.6 + config.phaseZ) * 0.25

        tempVector.set(floatX, floatY, floatZ)
        const distance = tempVector.distanceTo(mouseWorld)
        if (distance < MOUSE_DISTANCE && distance > 0.01) {
          const strength = (1 - distance / MOUSE_DISTANCE) * 0.28
          tempVector.sub(mouseWorld).normalize().multiplyScalar(strength)
          offset.add(tempVector)
          if (offset.length() > 4) offset.setLength(4)
        }

        offset.multiplyScalar(0.91)

        const position = currentPositions[index]
        position.x = floatX + offset.x
        position.y = floatY + offset.y
        position.z = floatZ + offset.z
        particlePositions[index * 3] = position.x
        particlePositions[index * 3 + 1] = position.y
        particlePositions[index * 3 + 2] = position.z
      }

      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const nearMouse = currentPositions[index].distanceTo(mouseWorld) < MOUSE_DISTANCE
        let connected = false

        if (!nearMouse) {
          for (let otherIndex = 0; otherIndex < PARTICLE_COUNT; otherIndex += 1) {
            if (index === otherIndex) continue
            if (
              currentPositions[index].distanceTo(currentPositions[otherIndex]) <
                CONNECTION_DISTANCE &&
              warmth[otherIndex] > 0.18
            ) {
              connected = true
              break
            }
          }
        }

        const target = nearMouse ? 1 : connected ? 0.42 : 0
        warmth[index] += (target - warmth[index]) * 0.065

        tempColor.lerpColors(COLD, WARM, warmth[index])
        particleColors[index * 3] = tempColor.r
        particleColors[index * 3 + 1] = tempColor.g
        particleColors[index * 3 + 2] = tempColor.b
      }

      let segment = 0
      for (let index = 0; index < PARTICLE_COUNT && segment < maxSegments; index += 1) {
        for (
          let otherIndex = index + 1;
          otherIndex < PARTICLE_COUNT && segment < maxSegments;
          otherIndex += 1
        ) {
          const distance = currentPositions[index].distanceTo(currentPositions[otherIndex])
          if (distance >= CONNECTION_DISTANCE) continue

          const warmValue = (warmth[index] + warmth[otherIndex]) * 0.5
          if (warmValue <= 0.02) continue

          const fade = 1 - distance / CONNECTION_DISTANCE
          tempColor.lerpColors(COLD, WARM, warmValue * fade)
          const bufferIndex = segment * 6

          linePositions[bufferIndex] = currentPositions[index].x
          linePositions[bufferIndex + 1] = currentPositions[index].y
          linePositions[bufferIndex + 2] = currentPositions[index].z
          linePositions[bufferIndex + 3] = currentPositions[otherIndex].x
          linePositions[bufferIndex + 4] = currentPositions[otherIndex].y
          linePositions[bufferIndex + 5] = currentPositions[otherIndex].z

          lineColors[bufferIndex] = tempColor.r
          lineColors[bufferIndex + 1] = tempColor.g
          lineColors[bufferIndex + 2] = tempColor.b
          lineColors[bufferIndex + 3] = tempColor.r
          lineColors[bufferIndex + 4] = tempColor.g
          lineColors[bufferIndex + 5] = tempColor.b
          segment += 1
        }
      }

      lineGeometry.setDrawRange(0, segment * 2)
      particlePositionAttribute.needsUpdate = true
      particleColorAttribute.needsUpdate = true
      linePositionAttribute.needsUpdate = true
      lineColorAttribute.needsUpdate = true

      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerout', handlePointerOut)
      window.removeEventListener('blur', resetPointer)
      renderer.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      particleTexture?.dispose()
      lineGeometry.dispose()
      lineMaterial.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-x-0 top-0 h-[860px] w-full sm:h-[920px] lg:h-[980px]"
      aria-hidden="true"
    />
  )
}
