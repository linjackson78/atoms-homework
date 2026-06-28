'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Zap, Plus, LogOut, Clock, CheckCircle2, AlertCircle,
  Loader2, Sparkles, ExternalLink
} from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'

type Project = {
  id: string
  name: string
  status: string
  is_public: boolean
  share_token: string | null
  created_at: string
  updated_at: string
}

interface Props {
  user: User
  initialProjects: Project[]
}

const STATUS_CONFIG = {
  idle: { label: 'Ready', icon: Clock, color: 'text-white/40' },
  generating: { label: 'Generating', icon: Loader2, color: 'text-yellow-400' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-emerald-400' },
  error: { label: 'Error', icon: AlertCircle, color: 'text-red-400' },
}

export default function DashboardClient({ user, initialProjects }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleNewProject = async () => {
    setCreating(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: 'Untitled Project', status: 'idle' })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create project')
      setCreating(false)
      return
    }

    router.push(`/workspace/${data.id}`)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">Atoms Demo</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-white/50">{displayName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white/40 hover:text-white/70 hover:bg-white/5 h-8 px-2"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">
            What will you build today?
          </h1>
          <p className="text-white/40">Describe your idea and let AI agents bring it to life.</p>
        </div>

        {/* New Project Button */}
        <button
          onClick={handleNewProject}
          disabled={creating}
          className="w-full mb-8 group relative rounded-2xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-violet-500/50 transition-all duration-200 p-8 flex flex-col items-center gap-3 cursor-pointer disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
            {creating ? (
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            ) : (
              <Plus className="w-5 h-5 text-violet-400" />
            )}
          </div>
          <div>
            <p className="text-white font-medium">New Project</p>
            <p className="text-sm text-white/40">Start building with AI agents</p>
          </div>
        </button>

        {/* Projects Grid */}
        {projects.length > 0 ? (
          <div>
            <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">
              Recent Projects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => {
                const statusCfg = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.idle
                const StatusIcon = statusCfg.icon
                return (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/workspace/${project.id}`)}
                    className="group bg-[#111111] border border-white/[0.06] rounded-xl p-5 cursor-pointer hover:border-white/15 hover:bg-[#161616] transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className={`flex items-center gap-1.5 ${statusCfg.color}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${project.status === 'generating' ? 'animate-spin' : ''}`} />
                        <span className="text-xs">{statusCfg.label}</span>
                      </div>
                    </div>

                    <h3 className="text-sm font-medium text-white mb-1 truncate group-hover:text-violet-300 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-white/30">
                      {formatDistanceToNow(new Date(project.updated_at))}
                    </p>

                    {project.is_public && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-violet-400/70">
                        <ExternalLink className="w-3 h-3" />
                        <span>Published</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-white/25">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>No projects yet. Create your first one above!</p>
          </div>
        )}
      </main>
    </div>
  )
}
