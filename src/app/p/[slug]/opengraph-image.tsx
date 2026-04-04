import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export const alt = 'PeladeiroPro - Prestação de contas do seu grupo'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: group } = await supabase
    .from('groups')
    .select('name, description')
    .eq('public_slug', slug)
    .single()

  const groupName = group?.name ?? 'Grupo'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1B1F4B 0%, #2D3278 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle pattern overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.05,
            display: 'flex',
            fontSize: 120,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.2,
          }}
        >
          {'⚽ ⚽ ⚽ ⚽ ⚽ ⚽ ⚽ ⚽ ⚽ ⚽ ⚽ ⚽'}
        </div>

        {/* Top: brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: 48 }}>⚽</span>
          <span
            style={{
              fontSize: 36,
              color: '#94a3b8',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            PeladeiroPro
          </span>
          <span style={{ fontSize: 48 }}>⚽</span>
        </div>

        {/* Group name */}
        <div
          style={{
            fontSize: groupName.length > 30 ? 52 : 64,
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.2,
            marginBottom: '20px',
            display: 'flex',
          }}
        >
          {groupName}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: '#cbd5e1',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            display: 'flex',
          }}
        >
          Prestação de contas
        </div>

        {/* Green accent bar at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 50%, #22c55e 100%)',
            display: 'flex',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  )
}
