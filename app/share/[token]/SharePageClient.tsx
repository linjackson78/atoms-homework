'use client'

import { useEffect, useRef } from 'react'

interface Props {
  project: {
    id: string
    name: string
    status: string
    created_at: string
  }
  messages: {
    id: string
    role: 'user' | 'agent' | 'system'
    agent_name: string | null
    content: string
    created_at: string
  }[]
  code: string | null
  publishedAt: string | null
  publishMode: 'latest' | 'pinned'
}

export default function SharePageClient({ code }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (iframeRef.current && code) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(code)
        doc.close()
      }
    }
  }, [code])

  return (
    <iframe
      ref={iframeRef}
      className="w-screen h-screen border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      title="Published App"
    />
  )
}
