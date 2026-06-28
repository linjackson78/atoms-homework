export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-white/40 mb-6">This page doesn&apos;t exist or has been removed.</p>
        <a
          href="/"
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          Go home →
        </a>
      </div>
    </div>
  )
}
