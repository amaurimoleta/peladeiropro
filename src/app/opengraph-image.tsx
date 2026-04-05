import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'PeladeiroPro - Gestão de Tesouraria para Peladas'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1B1F4B',
        backgroundImage: 'linear-gradient(135deg, #1B1F4B 0%, #2a2f6b 50%, #1B1F4B 100%)',
      }}>
        {/* Soccer decorations */}
        <div style={{ position: 'absolute', top: 40, left: 60, fontSize: 80, opacity: 0.1, display: 'flex' }}>⚽</div>
        <div style={{ position: 'absolute', bottom: 50, right: 80, fontSize: 60, opacity: 0.1, display: 'flex' }}>⚽</div>
        <div style={{ position: 'absolute', top: 120, right: 120, fontSize: 40, opacity: 0.08, display: 'flex' }}>⚽</div>

        {/* Green accent line */}
        <div style={{
          width: 120,
          height: 6,
          backgroundColor: '#00C853',
          borderRadius: 3,
          marginBottom: 30,
          display: 'flex',
        }} />

        {/* Main title */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
        }}>
          <span style={{
            fontSize: 72,
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-2px',
          }}>
            Peladeiro
          </span>
          <span style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#00C853',
            letterSpacing: '-2px',
          }}>
            Pro
          </span>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 28,
          color: 'rgba(255,255,255,0.6)',
          marginTop: 16,
          display: 'flex',
        }}>
          Agora o seu grupo também pode ser uma SAF
        </div>

        {/* Green divider */}
        <div style={{
          width: 80,
          height: 4,
          backgroundColor: '#00C853',
          borderRadius: 2,
          marginTop: 40,
          marginBottom: 24,
          display: 'flex',
        }} />

        {/* Description */}
        <div style={{
          fontSize: 20,
          color: 'rgba(255,255,255,0.4)',
          display: 'flex',
        }}>
          Gestão de Tesouraria para Peladas
        </div>
      </div>
    ),
    { ...size }
  )
}
