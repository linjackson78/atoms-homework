import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SharePageClient from './SharePageClient'

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // 通过 share_token 查询公开项目（不需要用户认证）
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  if (error || !project) {
    notFound()
  }

  // 获取消息历史
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true })

  // 根据发布模式决定加载哪个代码快照
  let snapshot: { html_code?: string } | null = null

  if (project.publish_mode === 'pinned' && project.publish_snapshot_id) {
    // 锁定版本：加载发布时指定的那条快照
    const { data: pinned } = await supabase
      .from('code_snapshots')
      .select('*')
      .eq('id', project.publish_snapshot_id)
      .single()
    snapshot = pinned
  } else {
    // 最新版本（或未指定快照）：加载最新快照
    const { data: snapshots } = await supabase
      .from('code_snapshots')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(1)
    snapshot = snapshots?.[0] || null
  }

  return (
    <SharePageClient
      project={project}
      messages={messages || []}
      code={snapshot?.html_code || null}
      publishedAt={project.published_at || null}
      publishMode={project.publish_mode === 'pinned' ? 'pinned' : 'latest'}
    />
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  const title = project?.name ? `${project.name} - Atoms Demo` : 'Shared App - Atoms Demo'
  const description = project?.name
    ? `Explore ${project.name}, an app built with Atoms Demo AI agents.`
    : 'An app built with Atoms Demo AI agents.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Atoms Demo',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
