export default function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0" style={{ background: 'var(--bn-app-bg)' }} />

      {/* Soft radial glows */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(900px 600px at 35% 10%, var(--bn-glow-1), transparent 60%), radial-gradient(900px 600px at 75% 30%, var(--bn-glow-2), transparent 60%), radial-gradient(900px 600px at 70% 85%, var(--bn-glow-3), transparent 60%)',
        }}
      />

      {/* Animated blobs */}
      <div
        className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl animate-blob1"
        style={{ background: 'var(--bn-blob-1)' }}
      />
      <div
        className="absolute top-40 -left-20 h-[520px] w-[520px] rounded-full blur-3xl animate-blob2"
        style={{ background: 'var(--bn-blob-2)' }}
      />
      <div
        className="absolute top-56 -right-24 h-[520px] w-[520px] rounded-full blur-3xl animate-blob3"
        style={{ background: 'var(--bn-blob-3)' }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.06] bg-[size:64px_64px]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--bn-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--bn-grid) 1px, transparent 1px)',
        }}
      />

      {/* Grain */}
      <div className="absolute inset-0 opacity-[0.16] mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.55%22/%3E%3C/svg%3E')]" />
    </div>
  )
}
