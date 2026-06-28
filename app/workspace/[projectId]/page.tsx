import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WorkspaceClient from './WorkspaceClient'

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 获取项目信息
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (error || !project) redirect('/dashboard')

  // 获取历史消息
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  // 获取最新代码快照
  const { data: snapshots } = await supabase
    .from('code_snapshots')
    .select('id, html_code, created_at, message_id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  return (
    <WorkspaceClient
      project={project}
      initialMessages={messages || []}
      initialCode={snapshots?.[0]?.html_code || null}
      initialSnapshots={snapshots || []}
    />
  )
}
