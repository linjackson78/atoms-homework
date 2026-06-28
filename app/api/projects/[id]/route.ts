import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 获取项目信息（包含发布相关字段：published_at, publish_mode, publish_snapshot_id）
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (pErr || !project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 获取消息历史
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  // 获取最新代码快照
  const { data: snapshots } = await supabase
    .from('code_snapshots')
    .select('id, html_code, created_at, message_id')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    project,
    messages: messages || [],
    latestCode: snapshots?.[0]?.html_code || null,
    snapshots: snapshots || [],
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, status } = body

  const updates: Record<string, string> = {}
  if (name) updates.name = name
  if (status) updates.status = status

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
