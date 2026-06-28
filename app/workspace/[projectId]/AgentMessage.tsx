'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

type Message = {
  id: string
  role: 'user' | 'agent' | 'system'
  agent_name: string | null
  content: string
  created_at: string
}

type AgentColor = {
  bg: string
  text: string
  name: string
  avatar: string
}

interface Props {
  message: Message
  agentColors: Record<string, AgentColor>
}

// 解析 Agent 消息，分割成多个 Agent 的内容块
function parseAgentContent(content: string) {
  const blocks: Array<{ agent: string; text: string }> = []
  const parts = content.split(/(\[(?:EMMA|BOB|ALEX)\])/g)

  let currentAgent = ''
  for (const part of parts) {
    const agentMatch = part.match(/\[(EMMA|BOB|ALEX)\]/)
    if (agentMatch) {
      currentAgent = agentMatch[1]
    } else if (currentAgent && part.trim()) {
      // 移除代码块
      const cleaned = part
        .replace(/```html[\s\S]*?```/g, '[Generated HTML code]')
        .replace(/```[\s\S]*?```/g, '[Code block]')
        .trim()
      if (cleaned) {
        blocks.push({ agent: currentAgent, text: cleaned })
      }
    } else if (!currentAgent && part.trim()) {
      // 可能有前置文本
      blocks.push({ agent: 'team', text: part.trim() })
    }
  }

  // 如果没有解析出 blocks，返回原始内容
  if (blocks.length === 0 && content.trim()) {
    const cleaned = content
      .replace(/```html[\s\S]*?```/g, '[Generated HTML code]')
      .replace(/```[\s\S]*?```/g, '[Code block]')
      .trim()
    blocks.push({ agent: 'team', text: cleaned })
  }

  return blocks
}

export default function AgentMessage({ message, agentColors }: Props) {
  const [expanded, setExpanded] = useState(true)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-violet-600/20 border border-violet-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5">
          <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    )
  }

  if (message.role === 'agent') {
    const blocks = parseAgentContent(message.content)
    const hasCode = message.content.includes('```html')

    return (
      <div className="space-y-2">
        {blocks.map((block, i) => {
          const color = agentColors[block.agent] || agentColors.team
          return (
            <div key={i} className="flex gap-2.5">
              <div className={cn(
                'w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-sm',
                color.bg
              )}>
                {color.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-medium mb-0.5', color.text)}>
                  {color.name}
                </p>
                <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
                  {block.text}
                </p>
              </div>
            </div>
          )
        })}
        {hasCode && (
          <div className="flex items-center gap-2 ml-9 mt-1">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-emerald-400/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              App generated
            </span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
        )}
      </div>
    )
  }

  return null
}
