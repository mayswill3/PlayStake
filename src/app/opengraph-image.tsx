import { ImageResponse } from 'next/og';

export const alt =
  'PlayStake, skill-based player-versus-player gaming for competitive players';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background:
            'radial-gradient(circle at 20% 10%, #173f38 0, #0b1220 45%, #070b13 100%)',
          color: '#f8fafc',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 980,
            padding: 72,
            width: '100%',
          }}
        >
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              fontSize: 38,
              fontWeight: 700,
              gap: 18,
            }}
          >
            <div
              style={{
                alignItems: 'center',
                background: '#5fdcb2',
                borderRadius: 18,
                color: '#071018',
                display: 'flex',
                fontSize: 28,
                fontWeight: 800,
                height: 64,
                justifyContent: 'center',
                width: 64,
              }}
            >
              PS
            </div>
            PlayStake
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1.05,
              marginTop: 70,
            }}
          >
            Put your skill
            <span style={{ color: '#5fdcb2' }}>on the line.</span>
          </div>
          <div
            style={{
              color: '#b7c2d0',
              display: 'flex',
              fontSize: 25,
              marginTop: 36,
            }}
          >
            Challenge real players. Agree the stake. Let skill decide.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
