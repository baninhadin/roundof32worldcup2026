import { ImageResponse } from 'next/og';

export const alt = 'What does my team need to qualify? World Cup 2026 group stage calculator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#0a0a0c',
          color: '#f6f6f8',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 36 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 22,
              background: 'linear-gradient(150deg, #ff3344, #b3121f)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 52,
              fontWeight: 900,
              color: '#fff',
            }}
          >
            32
          </div>
          <div style={{ fontSize: 30, color: '#9a9aa6' }}>World Cup 2026 · group stage</div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 78,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -2,
          }}
        >
          <div style={{ display: 'flex' }}>What does my team</div>
          <div style={{ display: 'flex' }}>
            need to&nbsp;<span style={{ color: '#ff3344' }}>qualify?</span>
          </div>
        </div>
        <div style={{ fontSize: 32, color: '#9a9aa6', marginTop: 34 }}>
          Pick a team, see exactly what it needs to reach the Round of 32.
        </div>
      </div>
    ),
    size,
  );
}
