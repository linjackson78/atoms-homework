'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Zap, ArrowLeft, Send, Loader2, Monitor, Smartphone,
  Code2, Eye, Sparkles, Copy, Check, Globe, Lock,
  Users, Code, History, RotateCcw, X, RefreshCw, Settings, Link2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import AgentMessage from './AgentMessage'
import AppPreview from './AppPreview'

type Project = {
  id: string
  name: string
  status: string
  share_token: string | null
  is_public: boolean
  published_at: string | null
  publish_mode: 'latest' | 'pinned' | null
  publish_snapshot_id: string | null
}

type CodeSnapshot = {
  id: string
  html_code: string
  created_at: string
  message_id: string | null
}

type Message = {
  id: string
  role: 'user' | 'agent' | 'system'
  agent_name: string | null
  content: string
  created_at: string
}

interface Props {
  project: Project
  initialMessages: Message[]
  initialCode: string | null
  initialSnapshots?: CodeSnapshot[]
}

export default function WorkspaceClient({ project, initialMessages, initialCode, initialSnapshots = [] }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [currentCode, setCurrentCode] = useState<string | null>(initialCode)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [currentAgent, setCurrentAgent] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop')
  const [projectMeta, setProjectMeta] = useState(project)
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>(initialSnapshots)
  const [showHistory, setShowHistory] = useState(false)
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(
    initialSnapshots.length > 0 ? initialSnapshots[0].id : null
  )
  const [mode, setMode] = useState<'team' | 'engineer'>('team')
  const [publishMode, setPublishMode] = useState<'latest' | 'pinned'>(
    project.publish_mode === 'pinned' ? 'pinned' : 'latest'
  )
  const [publishSnapshotId, setPublishSnapshotId] = useState<string | null>(
    project.publish_snapshot_id || null
  )
  const [showPublishConfig, setShowPublishConfig] = useState(false)
  const [updating, setUpdating] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const publishConfigRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // 点击外部关闭发布配置下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (publishConfigRef.current && !publishConfigRef.current.contains(e.target as Node)) {
        setShowPublishConfig(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const buildConversationHistory = useCallback(() => {
    return messages
      .filter(m => m.role === 'user' || m.role === 'agent')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
  }, [messages])

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return

    const userPrompt = prompt.trim()
    setPrompt('')
    setIsGenerating(true)
    setStreamingContent('')
    setCurrentAgent(null)

    // 立即添加用户消息到 UI
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      agent_name: null,
      content: userPrompt,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          prompt: userPrompt,
          conversationHistory: buildConversationHistory(),
          mode,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Generation request failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const event = JSON.parse(data)

            if (event.type === 'agent_switch') {
              setCurrentAgent(event.agent)
            } else if (event.type === 'token') {
              accumulatedContent += event.content
              setStreamingContent(accumulatedContent)
            } else if (event.type === 'done') {
              if (event.code) {
                setCurrentCode(event.code)
              }
              setViewMode('preview')
            } else if (event.type === 'error') {
              toast.error(event.message)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 流结束后添加 agent 消息
      if (accumulatedContent) {
        const agentMsg: Message = {
          id: `temp-agent-${Date.now()}`,
          role: 'agent',
          agent_name: 'team',
          content: accumulatedContent,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, agentMsg])
        setStreamingContent('')
        setCurrentAgent(null)

        // 刷新项目名和快照
        const res = await fetch(`/api/projects/${project.id}`)
        const data = await res.json()
        if (data.project) {
          setProjectMeta(data.project)
          setPublishMode(data.project.publish_mode === 'pinned' ? 'pinned' : 'latest')
          setPublishSnapshotId(data.project.publish_snapshot_id || null)
        }
        if (data.snapshots) {
          setSnapshots(data.snapshots)
          if (data.snapshots.length > 0) {
            setActiveSnapshotId(data.snapshots[0].id)
          }
        }
      }

    } catch (error) {
      console.error(error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }

  // 发布：生成 token，默认 latest 模式，复制链接到剪贴板
  const handlePublish = async () => {
    setSharing(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_mode: 'latest' }),
      })
      const data = await res.json()
      if (data.shareToken) {
        setProjectMeta(data.project)
        setPublishMode('latest')
        setPublishSnapshotId(null)
        const url = `${window.location.origin}/share/${data.shareToken}`
        await navigator.clipboard.writeText(url)
        setCopied(true)
        toast.success('Published! Link copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      toast.error('Failed to publish')
    } finally {
      setSharing(false)
    }
  }

  // 更新发布：推送最新构建（latest 模式）
  const handleUpdatePublish = async () => {
    if (publishMode === 'pinned') {
      toast.info('Switch to "Always Latest" to update to the newest build')
      return
    }
    setUpdating(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_mode: 'latest', publish_snapshot_id: null }),
      })
      const data = await res.json()
      if (data.project) {
        setProjectMeta(data.project)
        setPublishMode('latest')
        setPublishSnapshotId(null)
        toast.success('Published version updated')
      }
    } catch {
      toast.error('Failed to update publish')
    } finally {
      setUpdating(false)
    }
  }

  // 取消发布
  const handleUnpublish = async () => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/share`, { method: 'DELETE' })
      const data = await res.json()
      if (data.project) {
        setProjectMeta(data.project)
        setPublishMode('latest')
        setPublishSnapshotId(null)
        setShowPublishConfig(false)
        toast.success('Project unpublished')
      }
    } catch {
      toast.error('Failed to unpublish')
    } finally {
      setUpdating(false)
    }
  }

  // 切换发布模式（Always Latest / Specify Version）
  const handlePublishModeChange = async (newMode: 'latest' | 'pinned') => {
    if (newMode === publishMode) return
    setUpdating(true)
    try {
      const body = newMode === 'latest'
        ? { publish_mode: 'latest' }
        : { publish_mode: 'pinned', publish_snapshot_id: publishSnapshotId || snapshots[0]?.id || null }
      const res = await fetch(`/api/projects/${project.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.project) {
        setProjectMeta(data.project)
        setPublishMode(newMode)
        if (newMode === 'latest') {
          setPublishSnapshotId(null)
        } else if (!publishSnapshotId && snapshots[0]) {
          setPublishSnapshotId(snapshots[0].id)
        }
        toast.success(newMode === 'latest' ? 'Switched to Always Latest' : 'Switched to Specify Version')
      }
    } catch {
      toast.error('Failed to update publish mode')
    } finally {
      setUpdating(false)
    }
  }

  // 锁定到指定快照版本
  const handleSelectSnapshot = async (snapshotId: string) => {
    if (snapshotId === publishSnapshotId) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_mode: 'pinned', publish_snapshot_id: snapshotId }),
      })
      const data = await res.json()
      if (data.project) {
        setProjectMeta(data.project)
        setPublishSnapshotId(snapshotId)
        setPublishMode('pinned')
        toast.success('Published version pinned')
      }
    } catch {
      toast.error('Failed to pin version')
    } finally {
      setUpdating(false)
    }
  }

  // 复制公开链接
  const handleCopyLink = async () => {
    if (!projectMeta.share_token) return
    const url = `${window.location.origin}/share/${projectMeta.share_token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRestoreSnapshot = (snapshot: CodeSnapshot) => {
    setCurrentCode(snapshot.html_code)
    setActiveSnapshotId(snapshot.id)
    toast.success('Restored to selected version')
  }

  const handleSnapshotPreview = (snapshot: CodeSnapshot) => {
    setCurrentCode(snapshot.html_code)
    setActiveSnapshotId(snapshot.id)
  }

  const getSnapshotLabel = (snapshot: CodeSnapshot, index: number) => {
    const msg = messages.find(m => m.id === snapshot.message_id)
    if (msg) {
      const text = msg.role === 'user' ? msg.content : (messages.find(m2 => m2.role === 'user' && new Date(m2.created_at) <= new Date(snapshot.created_at))?.content || '')
      return text.slice(0, 40) + (text.length > 40 ? '...' : '')
    }
    return `Version ${snapshots.length - index}`
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const agentColors: Record<string, { bg: string; text: string; name: string; avatar: string }> = {
    EMMA: { bg: 'bg-pink-500/10', text: 'text-pink-400', name: 'Emma', avatar: '👩‍💼' },
    BOB: { bg: 'bg-blue-500/10', text: 'text-blue-400', name: 'Bob', avatar: '👨‍💻' },
    ALEX: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', name: 'Alex', avatar: '⚡' },
    team: { bg: 'bg-violet-500/10', text: 'text-violet-400', name: 'Agents', avatar: '🤖' },
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <header className="flex-none h-12 border-b border-white/[0.06] flex items-center px-4 gap-3">
        <Link href="/dashboard" className="text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded flex items-center justify-center flex-shrink-0">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium text-white truncate">{projectMeta.name}</span>
          {projectMeta.is_public && (
            <span className="flex-shrink-0 flex items-center gap-1 text-xs text-violet-400/70 bg-violet-500/10 rounded-full px-2 py-0.5">
              <Globe className="w-2.5 h-2.5" />
              Published
            </span>
          )}

          {/* Mode Toggle - temporarily hidden */}
          {false && (
          <div className="flex-shrink-0 flex rounded-lg bg-white/5 p-0.5 ml-2">
            <button
              onClick={() => setMode('team')}
              disabled={isGenerating}
              className={cn(
                'flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs font-medium transition-all',
                mode === 'team'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70',
                isGenerating && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Users className="w-3 h-3" />
              Team
            </button>
            <button
              onClick={() => setMode('engineer')}
              disabled={isGenerating}
              className={cn(
                'flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs font-medium transition-all',
                mode === 'engineer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70',
                isGenerating && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Code className="w-3 h-3" />
              Engineer
            </button>
          </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {projectMeta.is_public && projectMeta.share_token ? (
            <>
              {/* Update 按钮：推送最新构建 */}
              <Button
                onClick={handleUpdatePublish}
                disabled={updating || !currentCode}
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs text-white/60 hover:text-white hover:bg-white/5"
              >
                {updating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5 mr-1" />Update</>
                )}
              </Button>

              {/* Copy link 按钮：直接在 header 中显示 */}
              <Button
                onClick={handleCopyLink}
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs text-white/60 hover:text-white hover:bg-white/5"
              >
                {copied ? (
                  <><Check className="w-3.5 h-3.5 mr-1" />Copied!</>
                ) : (
                  <><Link2 className="w-3.5 h-3.5 mr-1" />Copy public link</>
                )}
              </Button>

              {/* 发布配置下拉菜单 */}
              <div className="relative" ref={publishConfigRef}>
                <button
                  onClick={() => setShowPublishConfig(!showPublishConfig)}
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-lg text-xs transition-all',
                    showPublishConfig
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>

                {showPublishConfig && (
                  <div className="absolute right-0 top-9 z-50 w-64 bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    {/* 模式选择器 */}
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => handlePublishModeChange('latest')}
                        disabled={updating}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all',
                          publishMode === 'latest'
                            ? 'bg-violet-500/15 text-violet-300'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="flex-1 text-left">Always Latest</span>
                        {publishMode === 'latest' && <Check className="w-3.5 h-3.5 text-violet-400" />}
                      </button>
                      <button
                        onClick={() => handlePublishModeChange('pinned')}
                        disabled={updating}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all',
                          publishMode === 'pinned'
                            ? 'bg-violet-500/15 text-violet-300'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="flex-1 text-left">Specify Version</span>
                        {publishMode === 'pinned' && <Check className="w-3.5 h-3.5 text-violet-400" />}
                      </button>
                    </div>

                    {/* 快照列表（仅 pinned 模式显示） */}
                    {publishMode === 'pinned' && (
                      <>
                        <div className="border-t border-white/[0.06]" />
                        <div className="p-2">
                          <p className="text-[10px] text-white/30 uppercase tracking-wide px-1.5 mb-1.5">Versions</p>
                          <div className="max-h-48 overflow-y-auto space-y-0.5">
                            {snapshots.length === 0 ? (
                              <p className="text-xs text-white/30 px-2 py-2">No versions available</p>
                            ) : (
                              snapshots.map((snap, idx) => {
                                const isSelected = snap.id === publishSnapshotId
                                return (
                                  <button
                                    key={snap.id}
                                    onClick={() => handleSelectSnapshot(snap.id)}
                                    disabled={updating}
                                    className={cn(
                                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all text-left',
                                      isSelected
                                        ? 'bg-violet-500/15 text-violet-300'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    )}
                                  >
                                    <span className="text-[10px] font-mono bg-white/5 rounded px-1 py-0.5 flex-shrink-0">
                                      v{snapshots.length - idx}
                                    </span>
                                    <span className="flex-1 truncate">{getSnapshotLabel(snap, idx)}</span>
                                    {isSelected && <Check className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      </>
                    )}


                  </div>
                )}
              </div>

              {/* Unpublish 按钮 */}
              <Button
                onClick={handleUnpublish}
                disabled={updating}
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs text-white/40 hover:text-red-400 hover:bg-red-500/5"
                title="Unpublish"
              >
                {updating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <><Lock className="w-3.5 h-3.5 mr-1" />Unpublish</>
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={sharing || !currentCode}
              size="sm"
              className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-500 text-white"
            >
              {sharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : copied ? (
                <><Check className="w-3.5 h-3.5 mr-1" />Copied!</>
              ) : (
                <><Globe className="w-3.5 h-3.5 mr-1" />Publish</>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Panel */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-white/[0.06]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streamingContent && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="text-white font-medium mb-1">Start building</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Describe what you want to build. Your AI team will analyze, design, and code it for you.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {[
                    'A todo app with dark theme',
                    'A weather dashboard',
                    'A recipe finder app',
                    'A simple calculator',
                  ].map(s => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <AgentMessage key={msg.id} message={msg} agentColors={agentColors} />
            ))}

            {/* Streaming Message */}
            {streamingContent && (
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  {currentAgent && agentColors[currentAgent] ? (
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-sm',
                      agentColors[currentAgent].bg
                    )}>
                      {agentColors[currentAgent].avatar}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {currentAgent && agentColors[currentAgent] && (
                    <p className={cn('text-xs font-medium mb-1', agentColors[currentAgent].text)}>
                      {agentColors[currentAgent].name}
                    </p>
                  )}
                  <StreamingText content={streamingContent} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex-none p-4 border-t border-white/[0.06]">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to build..."
                disabled={isGenerating}
                rows={3}
                className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm pr-12 focus:border-violet-500 focus:ring-0 rounded-xl"
              />
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="absolute right-3 bottom-3 w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
            <p className="text-xs text-white/25 mt-2 text-center">
              ⌘ + Enter to send
            </p>
          </div>
        </div>

        {/* Right: App Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Viewer Toolbar */}
          <div className="flex-none h-10 border-b border-white/[0.06] flex items-center px-4 gap-2">
            <div className="flex rounded-lg bg-white/5 p-0.5">
              <button
                onClick={() => setViewMode('preview')}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-6 rounded-md text-xs font-medium transition-all',
                  viewMode === 'preview'
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-6 rounded-md text-xs font-medium transition-all',
                  viewMode === 'code'
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                <Code2 className="w-3 h-3" />
                Code
              </button>
            </div>

            {viewMode === 'preview' && (
              <div className="flex rounded-lg bg-white/5 p-0.5">
                <button
                  onClick={() => setDeviceMode('desktop')}
                  className={cn(
                    'flex items-center gap-1 px-2 h-6 rounded-md text-xs transition-all',
                    deviceMode === 'desktop' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                  )}
                >
                  <Monitor className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setDeviceMode('mobile')}
                  className={cn(
                    'flex items-center gap-1 px-2 h-6 rounded-md text-xs transition-all',
                    deviceMode === 'mobile' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                  )}
                >
                  <Smartphone className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                'flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-all ml-auto',
                showHistory
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
              )}
            >
              <History className="w-3.5 h-3.5" />
              History
              {snapshots.length > 0 && (
                <span className="ml-1 bg-white/10 text-white/60 rounded-full px-1.5 py-0.5 text-[10px] leading-none">
                  {snapshots.length}
                </span>
              )}
            </button>
          </div>

          {/* Viewer Content */}
          <div className="flex-1 overflow-hidden bg-[#0d0d0d] flex">
            <div className="flex-1 overflow-hidden">
              {viewMode === 'preview' ? (
                <AppPreview
                  code={currentCode}
                  deviceMode={deviceMode}
                  isGenerating={isGenerating}
                />
              ) : (
                <CodeView code={currentCode} />
              )}
            </div>

            {/* History Sidebar */}
            {showHistory && (
              <div className="w-64 flex-shrink-0 border-l border-white/[0.06] bg-[#0d0d0d] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Version History
                  </span>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {snapshots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/20 text-xs px-4 text-center">
                      <History className="w-6 h-6 mb-2" />
                      No versions yet
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {snapshots.map((snap, idx) => {
                        const isActive = snap.id === activeSnapshotId
                        return (
                          <div
                            key={snap.id}
                            onClick={() => handleSnapshotPreview(snap)}
                            className={cn(
                              'rounded-lg p-2.5 cursor-pointer transition-all group border',
                              isActive
                                ? 'bg-violet-500/10 border-violet-500/30'
                                : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08]'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={cn(
                                    'text-[10px] font-mono font-medium rounded px-1 py-0.5',
                                    isActive ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-white/40'
                                  )}>
                                    v{snapshots.length - idx}
                                  </span>
                                  {isActive && (
                                    <span className="text-[10px] text-violet-400 font-medium">current</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-white/50 truncate">
                                  {getSnapshotLabel(snap, idx)}
                                </p>
                                <p className="text-[10px] text-white/25 mt-0.5">
                                  {formatTime(snap.created_at)}
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRestoreSnapshot(snap)
                                }}
                                disabled={isActive}
                                title="Restore this version"
                                className={cn(
                                  'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-all',
                                  isActive
                                    ? 'text-white/10 cursor-not-allowed'
                                    : 'text-white/30 hover:text-violet-400 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100'
                                )}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 流式文本组件（只展示非代码部分）
function StreamingText({ content }: { content: string }) {
  // 移除代码块以节省空间展示
  const displayContent = content
    .replace(/```html[\s\S]*?```/g, '\n[Generating code...]\n')
    .replace(/```[\s\S]*?```/g, '\n[Code block]\n')

  return (
    <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-mono">
      {displayContent}
      <span className="inline-block w-1.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />
    </div>
  )
}

// 代码视图组件
function CodeView({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!code) {
    return (
      <div className="h-full flex items-center justify-center text-white/20">
        <Code2 className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <button
        onClick={handleCopy}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 transition-all"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="h-full overflow-auto p-4 text-xs text-white/70 font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}
