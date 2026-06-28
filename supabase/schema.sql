-- Atoms Demo 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'generating', 'done', 'error')),
  share_token TEXT UNIQUE,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 消息表（对话历史）
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  agent_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 代码快照表
CREATE TABLE IF NOT EXISTS code_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  html_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS（Row Level Security）策略
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_snapshots ENABLE ROW LEVEL SECURITY;

-- projects RLS
CREATE POLICY "Users can manage own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Public projects are viewable by all"
  ON projects FOR SELECT
  USING (is_public = true);

-- messages RLS
CREATE POLICY "Users can manage messages of own projects"
  ON messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = messages.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Public project messages viewable by all"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = messages.project_id
        AND projects.is_public = true
    )
  );

-- code_snapshots RLS
CREATE POLICY "Users can manage snapshots of own projects"
  ON code_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = code_snapshots.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Public project snapshots viewable by all"
  ON code_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = code_snapshots.project_id
        AND projects.is_public = true
    )
  );

-- 更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 发布功能扩展
ALTER TABLE projects ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS publish_mode TEXT DEFAULT 'latest' CHECK (publish_mode IN ('latest', 'pinned'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS publish_snapshot_id UUID REFERENCES code_snapshots(id) ON DELETE SET NULL;
