import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * 画面の奥で常に動いている夜の設計室。
 * 変形と背景位置だけを動かし、時間跳躍の局面では時間軸を速める。
 */
export function Background({ phase }: { phase: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const driftRef = useRef<gsap.core.Tween[]>([])

  useEffect(() => {
    const root = rootRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const context = gsap.context(() => {
      const orbs = [...root.querySelectorAll<HTMLElement>('.bg__orb')]
      const drift = orbs.map((orb, index) =>
        gsap.to(orb, {
          xPercent: index % 2 === 0 ? 16 : -18,
          yPercent: index % 2 === 0 ? -12 : 14,
          scale: 1.18 - index * 0.06,
          duration: 18 + index * 6,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        }),
      )

      // one full tile per cycle, so the loop restarts without a visible seam
      const dust = root.querySelector<HTMLElement>('.bg__dust')
      if (dust) {
        drift.push(gsap.to(dust, { x: 150, y: -150, duration: 90, repeat: -1, ease: 'none' }))
      }

      const grid = root.querySelector<HTMLElement>('.bg__grid')
      if (grid) {
        drift.push(
          gsap.to(grid, { opacity: 0.45, duration: 11, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
        )
      }

      driftRef.current = drift
    }, root)

    return () => {
      driftRef.current = []
      context.revert()
    }
  }, [])

  // 100年を渡るあいだだけ、奥の景色も加速させる
  useEffect(() => {
    const warping = phase === 'jump'
    driftRef.current.forEach((animation) => {
      gsap.to(animation, { timeScale: warping ? 8 : 1, duration: 0.9, ease: 'power2.inOut' })
    })
    if (rootRef.current) {
      gsap.to(rootRef.current, {
        opacity: warping ? 1 : 0.9,
        scale: warping ? 1.12 : 1,
        duration: 1.1,
        ease: 'power2.inOut',
      })
    }
  }, [phase])

  return (
    <div className="bg" ref={rootRef} aria-hidden="true">
      <i className="bg__orb bg__orb--primary" />
      <i className="bg__orb bg__orb--tertiary" />
      <i className="bg__orb bg__orb--city" />
      <i className="bg__grid" />
      <i className="bg__dust" />
    </div>
  )
}
