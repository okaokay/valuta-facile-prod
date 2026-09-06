import { useEffect, useRef } from 'react'
import Matter from 'matter-js'

const CTA_ITEMS = [
  'Inizia ora',
  'Valuta gratis',
  'Scopri il valore',
  'Simula vendita',
  'Richiedi consulenza',
  'Stampa report',
  'Confronta zona',
  'Invia dati',
  'Salva stima',
  'Parla con un agente'
]

function MatterCtaPlayground() {
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const runnerRef = useRef(null)
  const bodiesRef = useRef([])
  const elementsRef = useRef([])
  const spawnWaveRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const { Engine, Runner, World, Bodies, Mouse, MouseConstraint } = Matter

    const width = container.clientWidth
    const height = container.clientHeight || 260

    const engine = Engine.create()
    engine.gravity.y = 1.2
    const world = engine.world

    const runner = Runner.create()

    const thickness = 10
    const floor = Bodies.rectangle(width / 2, height + thickness / 2, width * 2, thickness, {
      isStatic: true
    })
    const wallLeft = Bodies.rectangle(-thickness / 2, height / 2, thickness, height * 2, {
      isStatic: true
    })
    const wallRight = Bodies.rectangle(width + thickness / 2, height / 2, thickness, height * 2, {
      isStatic: true
    })

    World.add(world, [floor, wallLeft, wallRight])

    const createCtaWave = (labels) => {
      const itemCount = labels.length
      const createdBodies = []
      const createdElements = []

      labels.forEach((label, index) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.textContent = label
        el.className =
          'absolute rounded-full border border-indigo-900 bg-white px-4 py-1.5 text-[10px] sm:text-xs font-semibold text-indigo-900 shadow-[2px_2px_0_rgba(15,23,42,0.8)] select-none'
        el.style.left = '0px'
        el.style.top = '0px'
        el.style.transformOrigin = 'center'
        container.appendChild(el)

        const rect = el.getBoundingClientRect()
        const bodyWidth = rect.width || 120
        const bodyHeight = rect.height || 32

        const spreadCount = Math.max(itemCount - 1, 1)
        const x = width * 0.1 + (width * 0.8 * index) / spreadCount
        const y = -40 - index * 16

        const body = Bodies.rectangle(x, y, bodyWidth, bodyHeight, {
          restitution: 0.4,
          friction: 0.2,
          frictionAir: 0.02,
          chamfer: 16
        })

        createdBodies.push(body)
        createdElements.push(el)
      })

      if (createdBodies.length) {
        World.add(world, createdBodies)
        bodiesRef.current = bodiesRef.current.concat(createdBodies)
        elementsRef.current = elementsRef.current.concat(createdElements)
      }
    }

    createCtaWave(CTA_ITEMS)
    spawnWaveRef.current = () => {
      createCtaWave(CTA_ITEMS)
    }

    const mouse = Mouse.create(container)
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    })
    World.add(world, mouseConstraint)

    engineRef.current = engine
    runnerRef.current = runner

    Runner.run(runner, engine)

    let frameId
    const bodyWidthHalf = (body) => {
      const bounds = body.bounds
      return (bounds.max.x - bounds.min.x) / 2
    }

    const bodyHeightHalf = (body) => {
      const bounds = body.bounds
      return (bounds.max.y - bounds.min.y) / 2
    }

    const update = () => {
      bodiesRef.current.forEach((body, i) => {
        const el = elementsRef.current[i]
        if (!el) return
        const { x, y } = body.position
        const angle = body.angle
        el.style.transform = `translate3d(${x - bodyWidthHalf(body)}px, ${y - bodyHeightHalf(
          body
        )}px, 0) rotate(${angle}rad)`
      })
      frameId = requestAnimationFrame(update)
    }

    update()

    const handleResize = () => {
      const newWidth = container.clientWidth
      if (!newWidth) return
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (frameId) cancelAnimationFrame(frameId)
      if (runnerRef.current && engineRef.current) {
        Runner.stop(runnerRef.current)
      }
      World.clear(world, false)
      Engine.clear(engine)
      elementsRef.current.forEach((el) => {
        if (el && el.parentNode === container) {
          container.removeChild(el)
        }
      })
      elementsRef.current = []
      bodiesRef.current = []
    }
  }, [])

  const handleAddMore = () => {
    if (spawnWaveRef.current) {
      spawnWaveRef.current()
    }
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
      />
      <button
        type="button"
        onClick={handleAddMore}
        className="absolute bottom-3 right-3 z-20 flex items-center justify-center h-8 w-8 rounded-full bg-white text-slate-900 text-base font-semibold shadow-[3px_3px_0_rgba(15,23,42,1)] border border-indigo-900"
      >
        +
      </button>
    </div>
  )
}

export default MatterCtaPlayground
