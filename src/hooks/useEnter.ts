import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * 画面が切り替わるたび、[data-enter] を持つ要素を順に立ち上げる。
 * useLayoutEffect なので、開始状態は最初の描画より前に入り、ちらつかない。
 */
export function useEnter<T extends HTMLElement>(key: unknown, delay = 0) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const targets = root.querySelectorAll('[data-enter]')
    if (targets.length === 0) return

    const tween = gsap.from(targets, {
      y: 16,
      opacity: 0,
      duration: 0.45,
      delay,
      // amount spreads a fixed total over however many targets there are.
      // A per-element delay would push the last one — always the button —
      // more than half a second behind the heading on the busier screens.
      stagger: { amount: 0.2 },
      ease: 'power3.out',
      clearProps: 'transform,opacity',
    })

    return () => {
      tween.kill()
      gsap.set(targets, { clearProps: 'transform,opacity' })
    }
  }, [key, delay])

  return ref
}
