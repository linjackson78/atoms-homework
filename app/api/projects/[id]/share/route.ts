import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

// POST /api/projects/[id]/share - 生成分享 token 并发布
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 读取可选的发布配置
  const body = await req.json().catch(() => ({}))
  const publishMode: 'latest' | 'pinned' = body.publish_mode === 'pinned' ? 'pinned' : 'latest'
  const publishSnapshotId =
    publishMode === 'pinned' && body.publish_snapshot_id ? body.publish_snapshot_id : null

  const shareToken = randomBytes(8).toString('hex')

  // 查询当前项目，判断是否首次发布（published_at 为 null）
  const { data: existing } = await supabase
    .from('projects')
    .select('published_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const updates: Record<string, unknown> = {
    share_token: shareToken,
    is_public: true,
    publish_mode: publishMode,
    publish_snapshot_id: publishSnapshotId,
  }

  // 仅首次发布时设置 published_at
  if (existing && !existing.published_at) {
    updates.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shareToken, project: data })
}

// PATCH /api/projects/[id]/share - 更新发布配置
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const updates: Record<string, unknown> = {}

  if (body.publish_mode === 'latest' || body.publish_mode === 'pinned') {
    updates.publish_mode = body.publish_mode
  }

  // 如果 publish_mode='latest'，清空 publish_snapshot_id
  if (body.publish_mode === 'latest') {
    updates.publish_snapshot_id = null
  } else if (body.publish_snapshot_id !== undefined) {
    updates.publish_snapshot_id = body.publish_snapshot_id
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ project: data })
}

// DELETE /api/projects/[id]/share - 取消分享/发布
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .update({
      share_token: null,
      is_public: false,
      published_at: null,
      publish_mode: 'latest',
      publish_snapshot_id: null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}
