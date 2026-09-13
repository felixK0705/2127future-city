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
        gsap.fromTo(
          orb,
          {
            xPercent: index % 2 === 0 ? -22 : 28,
            yPercent: index % 2 === 0 ? 18 : -24,
            scale: 0.9,
          },
          {
            xPercent: index % 2 === 0 ? 48 : -52,
            yPercent: index % 2 === 0 ? -36 : 40,
            scale: 1.14,
            duration: 10 + index * 2.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            force3D: true,
          },
        ),
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

  // 幕の裏では球を止める。見えない加速は本編の描画と争うだけ。
  useEffect(() => {
    const hidden = phase === 'jump'
    driftRef.current.forEach((animation) => {
      gsap.to(animation, { timeScale: hidden ? 0 : 1, duration: hidden ? 0.2 : 0.6, ease: 'power2.out' })
    })
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
