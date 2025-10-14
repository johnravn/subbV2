import * as React from 'react'

type MapEmbedProps = {
  /** What to show in Maps: full address, place name, or "lat,lng" */
  query: string
  /** Optional: 1–20 (lower = farther out) */
  zoom?: number
  /** Optional sizing; defaults to responsive 16:9 */
  className?: string
  style?: React.CSSProperties
  width?: number | string
  height?: number | string
  title?: string
}

export default function MapEmbed({
  query,
  zoom,
  className,
  style,
  width = '100%',
  height = 0, // 0 means we’ll use the aspect-ratio container
  title = 'Google Maps location',
}: MapEmbedProps) {
  // In Vite, env vars must be prefixed with VITE_
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_API_KEY as
    | string
    | undefined

  if (!mapsKey) {
    // Fail loud in dev, quiet in prod
    if (import.meta.env.DEV) {
      console.warn(
        'VITE_GOOGLE_MAPS_API_KEY is missing. Add it to your .env file.',
      )
    }
    return null
  }

  const url = new URL('https://www.google.com/maps/embed/v1/place')
  url.searchParams.set('q', query) // URL handles encoding (æ/ø/å etc.)
  if (zoom != null) url.searchParams.set('zoom', String(zoom))
  url.searchParams.set('key', mapsKey)

  // If caller didn’t provide a fixed height, render a responsive 16:9 box
  const responsive = height === 0

  return (
    <div
      className={className}
      style={{
        position: responsive ? 'relative' : undefined,
        width,
        ...(responsive
          ? {
              aspectRatio:
                '16 / 9' as unknown as React.CSSProperties['aspectRatio'],
            }
          : { height }),
        ...style,
        borderRadius: '5px',
        overflow: 'clip',
      }}
    >
      <iframe
        title={title}
        src={url.toString()}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        style={{
          border: 0,
          position: responsive ? 'absolute' : undefined,
          inset: responsive ? 0 : undefined,
          width: '100%',
          height: responsive ? '100%' : height || '100%',
        }}
      />
    </div>
  )
}
