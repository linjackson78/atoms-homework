'use client'

import { useRef, useEffect } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  code: string | null
  deviceMode: 'desktop' | 'mobile'
  isGenerating: boolean
}

export default function AppPreview({ code, deviceMode, isGenerating }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!iframeRef.current || !code) return
    const iframe = iframeRef.current
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    doc.open()
    doc.write(code)
    doc.close()
  }, [code])

  if (isGenerating && !code) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-white/30">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-violet-400/50" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0d0d0d] flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white/50">Agents are building your app...</p>
          <p className="text-xs text-white/25 mt-1">Emma, Bob and Alex are collaborating</p>
        </div>
        <div className="flex gap-2">
          {['Emma', 'Bob', 'Alex'].map((name, i) => (
            <div
              key={name}
              className="flex items-center gap-1.5 text-xs bg-white/5 rounded-full px-3 py-1"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-white/40">{name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!code) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <Sparkles className="w-7 h-7" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white/30">App preview will appear here</p>
          <p className="text-xs text-white/20 mt-1">Send a prompt to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center p-4 bg-[#0d0d0d]">
      <div className={cn(
        'relative h-full transition-all duration-300 bg-white rounded-xl overflow-hidden shadow-2xl shadow-black/50',
        deviceMode === 'desktop' ? 'w-full' : 'w-[375px]'
      )}>
        {/* Browser chrome */}
        <div className="bg-[#f0f0f0] flex items-center gap-1.5 px-3 py-2 border-b border-black/10 flex-shrink-0">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 mx-2 bg-white rounded-md px-2 py-0.5 text-xs text-gray-400 font-mono">
            atoms-demo-app
          </div>
          {isGenerating && (
            <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
          )}
        </div>

        <iframe
          ref={iframeRef}
          className="w-full flex-1 border-0"
          style={{ height: 'calc(100% - 32px)' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          title="App Preview"
        />
      </div>
    </div>
  )
}
