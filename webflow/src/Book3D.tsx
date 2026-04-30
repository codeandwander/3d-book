import React, { useEffect, useRef } from 'react'
// @ts-ignore - book.js is plain JS
import { mount } from '../../src/book.js'

type ImageValue = { src: string; alt?: string }

export interface Book3DProps {
  // Content
  coverImage?: ImageValue
  backImage?: ImageValue
  title?: string
  author?: string
  spineText?: string

  // Cover look
  coverColor?: string
  titleColor?: string
  titleFont?: string
  coverFinish?: string
  coverTexture?: string

  // Spine look
  spineColor?: string
  spineTextColor?: string

  // Pages look
  pageColor?: string
  endpaperColor?: string

  // Construction
  hardcover?: boolean
  sleeve?: boolean

  // Dimensions (relative units; the renderer auto-frames the camera)
  width?: number
  height?: number
  thickness?: number

  // Behaviour
  autoRotate?: boolean
  autoRotateSpeed?: number
  hoverTilt?: number

  // Container
  containerHeight?: string
  background?: string
}

type BookInstance = {
  update: (patch: Record<string, unknown>) => void
  destroy: () => void
}

const PASS_THROUGH = [
  'title', 'author', 'spineText',
  'coverColor', 'titleColor', 'titleFont',
  'coverFinish', 'coverTexture',
  'spineColor', 'spineTextColor',
  'pageColor', 'endpaperColor',
  'hardcover', 'sleeve',
  'width', 'height', 'thickness',
  'autoRotate', 'autoRotateSpeed', 'hoverTilt',
] as const

function buildConfig(props: Book3DProps): Record<string, unknown> {
  const cfg: Record<string, unknown> = {}
  for (const key of PASS_THROUGH) {
    const v = props[key]
    if (v !== undefined && v !== '') cfg[key] = v
  }
  cfg.coverImage = props.coverImage?.src || null
  cfg.backImage = props.backImage?.src || null
  return cfg
}

export function Book3D(props: Book3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instRef = useRef<BookInstance | null>(null)

  const cfg = buildConfig(props)
  const cfgKey = JSON.stringify(cfg)

  useEffect(() => {
    if (!containerRef.current) return
    instRef.current = mount(containerRef.current, cfg) as BookInstance
    return () => {
      instRef.current?.destroy()
      instRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isFirstRun = useRef(true)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    instRef.current?.update(cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey])

  const style: React.CSSProperties = {
    width: '100%',
    height: props.containerHeight || '600px',
    background: props.background || undefined,
  }

  return <div ref={containerRef} style={style} />
}
