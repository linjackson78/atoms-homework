# Atoms Demo 技术方案（已对照笔试文档校准）

> 本方案已结合飞书笔试文档原文（`【请创建副本后使用】ROOT 全栈岗位笔试——XXX.pdf`）进行校准，重点对齐 6-8 小时时间窗口、"不考察用 Atoms 做 Atoms，而考察借助 AI 工具快速交付可运行原型" 的核心导向。

---

## 1. 挑战内容原文要点

- **目标**：在 **6-8 小时**内完成一个可运行的 **Atoms Demo**。
- **核心要求**：
  - 通过**智能体驱动**的方式完成代码/应用生成。
  - 将生成的应用以**可视化网页形式**进行展示。
  - **真实交互**（非静态展示）。
  - **数据持久化**（不限技术方案）。
  - 尽量覆盖**基本使用流程**：初始化 / 注册 / 核心主流程。
  - **至少一个延展或衍生能力**。
- **关键导向**：不考察是否“用 Atoms 做 Atoms”，而是关注如何借助 AI 工具（Claude Code、Cursor、Codex 等）将想法快速转化为**可运行、可体验、可扩展**的产品原型。
- **提交物**：
  - 可测试的在线访问链接（自行部署）。
  - GitHub 源代码链接。
  - 简要说明文档：实现思路、完成程度、后续扩展计划与优先级。
- **评估维度**：完成度、工程思维、用户体验、创新性、可交付性。

---

## 2. 产品理解：Atoms 的核心交互模式

参考 https://help.atoms.dev/en 官方文档，Atoms 的核心体验是：

1. 用户通过自然语言 Prompt 输入需求。
2. 多 Agent 协同工作（Emma 分析需求、Bob 设计架构、Alex 写代码等）。
3. 实时展示 Agent 工作状态（流式输出）。
4. App Viewer 中预览生成的应用（实时渲染）。
5. 支持持续对话迭代修改。
6. 支持发布/分享。

对于本次 Demo，不必 1:1 复刻 Atoms 全部能力，但需要抓住其**最具辨识度的交互闭环**：

```
自然语言需求 → 多 Agent 流式协作 → 代码生成 → 实时预览 → 迭代/分享
```

---

## 3. 技术选型

### 前端

- **Next.js 16**（App Router）+ **React 19** + **TypeScript**
  - 当前仓库已实际使用 Next.js 16，方案以实际版本为准。
  - Server Components 处理数据获取；Client Components 处理聊天、预览、SSE。
- **Tailwind CSS v4** + **shadcn/ui**
  - 快速搭建接近 Atoms 暗色风格的 UI。
- **iframe 沙箱预览**（当前实现）
  - 生成单文件 HTML 后直接写入 iframe，成本低、6-8h 内最稳。
- **Sandpack**（`@codesandbox/sandpack-react`，已安装）
  - 作为后续升级多文件 React 工程的备选，本次 Demo 时间允许可替换 iframe。
- **TanStack Query**
  - 管理项目列表、生成状态等异步数据。

### 后端

- **Next.js API Routes**（Node.js Runtime，`maxDuration: 60`）
  - 当前 `/api/generate` 已采用 Node.js Runtime + `ReadableStream` 流式 SSE。
  - 无需额外部署独立后端服务。
- **OpenAI 兼容 API**
  - 默认 `gpt-4o-mini`，实际通过环境变量可切换到 `moonshot-v1-8k` 等 OpenAI 兼容端点。
  - SSE 流式返回，前端实时展示 Agent 输出。
- **多 Agent 模拟**
  - 通过 System Prompt 让 LLM 按 `[EMMA] / [BOB] / [ALEX]` 格式输出。
  - 真正并行调度留作未来升级，Demo 阶段用单轮流式模拟即可。

### 数据库

- **Supabase**（PostgreSQL + Auth）
  - 免费 tier，提供 Auth、Database、Row Level Security。
  - 用 RLS 保证用户只能访问自己的项目。

### 认证

- **Supabase Auth**
  - email/password + Google OAuth（可选）。
  - Next.js middleware 保护 `/dashboard`、`/workspace` 等路由。

### 部署

- **Vercel** 部署 Next.js 前端。
- **Supabase** 托管数据库与认证。
- 环境变量：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `OPENAI_MODEL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 4. 数据模型

```sql
-- 用户表（由 Supabase Auth 管理）
users: id, email, name, avatar_url, created_at

-- 项目表
projects:
  id UUID PRIMARY KEY
  user_id UUID -> auth.users(id)
  name TEXT
  status TEXT CHECK IN ('idle','generating','done','error')
  share_token TEXT UNIQUE
  is_public BOOLEAN DEFAULT false
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

-- 消息表（对话历史）
messages:
  id UUID PRIMARY KEY
  project_id UUID -> projects(id)
  role TEXT CHECK IN ('user','agent','system')
  agent_name TEXT          -- EMMA / BOB / ALEX / team
  content TEXT
  created_at TIMESTAMPTZ

-- 代码快照表
code_snapshots:
  id UUID PRIMARY KEY
  project_id UUID -> projects(id)
  message_id UUID -> messages(id)
  html_code TEXT NOT NULL
  created_at TIMESTAMPTZ
```

> 注：当前 Demo 采用单文件 HTML 产物，已能覆盖“生成→预览→分享”主流程。若时间富余，可将 `html_code` 扩展为 `files JSONB` 以支持 Sandpack 多文件工程。

---

## 5. 系统架构图

```
用户浏览器
    │
    ▼
Next.js Frontend (Vercel CDN)
    │
    ├──→ Next.js API Routes (Serverless)
    │        │
    │        ├──→ OpenAI API（代码生成 streaming）
    │        └──→ Supabase Client
    │                 │
    │                 └──→ Supabase PostgreSQL（数据持久化）
    │                          + Supabase Auth（用户认证）
    │
    └──→ iframe 沙箱（代码在浏览器内执行，无需后端）
```

---

## 6. 核心功能模块（6-8h 优先级排序）

### P0：必须完成（基本流程）

| 模块 | 内容 | 建议工时 |
|------|------|----------|
| 项目初始化 | Next.js 16 + Tailwind + shadcn + Supabase + OpenAI SDK 集成 | 30min |
| 用户认证页面 | `/login`、 `/register`、Supabase Auth、Middleware 路由守卫 | 45min |
| 项目管理 Dashboard | `/dashboard` 项目列表、新建项目、跳转工作区 | 30min |
| Workspace 核心工作区 | 左 Chat / 右 App Viewer、设备切换、代码视图 | 2.5h |
| AI 生成服务 | `/api/generate` SSE 流式、System Prompt 多角色输出、代码解析与存储 | 2h |
| 发布/分享 | `/share/[token]` 公开页、权限切换、复制链接 | 45min |

### P1：延展能力（建议至少选一个）

| 模块 | 内容 | 建议工时 |
|------|------|----------|
| 模式切换 | Engineer Mode（仅 Alex）vs Team Mode（Emma + Bob + Alex） | 30min |
| 版本历史 | 保存每次生成快照，支持查看/切换/回退 | 45min |
| 文件/图片上传 | 上传参考文件并在 prompt 中引用 | 45min |

### P2：可选加分项

- **Remix**：从公开分享项目一键复制并二次创作。
- **GitHub/GitLab 导出**：版本控制集成。
- **Sandpack 多文件工程**：将单文件 HTML 升级为多文件 React 项目预览。

---

## 7. Agent 流式生成逻辑

```
用户输入 Prompt
    │
    ▼
Workspace 前端 → POST /api/generate
    │
    ▼
System Prompt 结构化多 Agent 输出：
  [Emma] 分析需求（2-3 句）
  [Bob]  设计架构（2-3 句）
  [Alex] 开始写代码 → streaming
    │
    ▼
SSE 流式返回，前端实时展示 Agent 对话气泡
    │
    ▼
解析最终代码块 → 存入 code_snapshots
    │
    ▼
iframe 渲染代码 → App Viewer 更新
```

### API 端点规划

- `POST /api/generate` → OpenAI streaming → SSE response
- `GET /api/projects` → 获取用户项目列表
- `POST /api/projects` → 创建新项目
- `GET /api/projects/[id]` → 获取项目历史消息和代码
- `POST /api/projects/[id]/share` → 发布（生成 token，设置 `is_public=true`）
- `PATCH /api/projects/[id]/share` → 更新发布配置（`publish_mode` / `publish_snapshot_id`）
- `DELETE /api/projects/[id]/share` → 取消发布

---

## 8. 发布功能设计

> 参考Atoms官方发布功能（https://help.atoms.dev/en/articles/12129354-publish），在现有分享能力（`share_token` + `is_public`）基础上扩展为完整的发布体系，支持版本控制、增量更新与取消发布。未注册用户可通过公开链接访问生成的网页。

### 8.1 功能需求

| 能力 | 说明 |
|------|------|
| **Publish** | 将应用发布为稳定公开链接，未注册用户可访问 |
| **Update** | 发布后推送最新构建到公开版本，无需重新生成链接 |
| **版本控制 - Always Latest** | 公开页自动加载最新一次生成的 `code_snapshot` |
| **版本控制 - Specify Version** | 锁定到特定历史快照版本，后续更新不影响公开页 |
| **Unpublish** | 取消发布，公开链接即时失效 |

### 8.2 数据模型扩展

在现有 `projects` 表基础上新增以下字段：

```sql
ALTER TABLE projects ADD COLUMN published_at TIMESTAMPTZ;           -- 首次发布时间
ALTER TABLE projects ADD COLUMN publish_mode TEXT DEFAULT 'latest'  -- 发布模式
  CHECK (publish_mode IN ('latest','pinned'));
ALTER TABLE projects ADD COLUMN publish_snapshot_id UUID;           -- 锁定的快照ID（pinned模式时使用）
```

> `publish_snapshot_id` 指向 `code_snapshots.id`，仅当 `publish_mode='pinned'` 时生效。

### 8.3 API 设计

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/projects/[id]/share` | 发布：生成 `share_token`，设置 `is_public=true`、`published_at=now()`、`publish_mode='latest'` |
| `PATCH` | `/api/projects/[id]/share` | 更新发布配置：修改 `publish_mode`、`publish_snapshot_id`；Update 操作刷新 `published_at` |
| `DELETE` | `/api/projects/[id]/share` | 取消发布：清除 `is_public`、`share_token`，公开链接失效 |

### 8.4 UI 设计

**Workspace 顶部工具栏（根据发布状态切换）：**

| 状态 | 展示元素 |
|------|----------|
| 未发布 | `Publish` 按钮 |
| 已发布 | `Published` 徽章 + `Update` 按钮 + `Unpublish` 按钮 + 发布配置下拉 |

**发布配置下拉：**
- Always Latest：公开页自动同步最新构建
- Specify Version：从历史快照列表中选择版本锁定

### 8.5 分享页行为

`/share/[token]` 公开页根据 `publish_mode` 决定加载内容：

```
publish_mode='latest'
  → 查询 projects.share_token 匹配的项目
  → 加载该项目最新一条 code_snapshot

publish_mode='pinned'
  → 查询 projects.share_token 匹配的项目
  → 加载 publish_snapshot_id 指定的 code_snapshot
```

> 安全约束：公开页仅返回 `is_public=true` 的项目，且仅返回快照的 `html_code`，不暴露项目元信息。

---

## 9. 关键技术决策说明

| 问题 | 决策 | 原因 |
|------|------|------|
| 代码执行环境 | iframe 沙箱（当前） | 6-8h 内最稳，单文件 HTML 即可满足真实交互 |
| 数据库选型 | Supabase | 免费、Auth 内置、SDK 简单、RLS 安全 |
| LLM 模型 | gpt-4o-mini（可切 moonshot-v1-8k） | 成本低、速度快、代码生成质量好 |
| 部署 | Vercel + Supabase | Next.js 原生支持、免费、一键部署 |
| 流式传输 | SSE（Server-Sent Events） | Next.js Node.js Runtime 原生支持 |
| 多 Agent | System Prompt 单轮模拟 | Demo 阶段避免复杂调度，效果足够 |

---

## 10. 交付物与提交文档模板

### 10.1 必须提交

- 可测试的在线访问链接（Vercel 部署）。
- GitHub 源代码链接（public）。
- 笔试文档副本（含链接）。

### 10.2 建议附带的简要说明文档

```markdown
# Atoms Demo 说明

## 实现思路
- 为什么选 Next.js + Supabase + OpenAI 兼容 API
- 多 Agent 模拟方案
- 代码预览与持久化方案

## 完成程度
- ✅ 已完成：注册/登录、Dashboard、Workspace、SSE 流式生成、iframe 预览、分享
- ⚠️ 部分完成：模式切换 UI（待接 API）
- ❌ 未完成：Sandpack 多文件、Remix、自定义域名

## 后续扩展计划与优先级
1. P1：模式切换真正影响 System Prompt
2. P1：版本历史与回退
3. P2：Sandpack 多文件工程
4. P2：GitHub 导出
```

---

## 11. 评估维度自检

| 评估维度 | 本方案如何回应 |
|----------|----------------|
| **完成度** | 覆盖注册/登录 → 创建项目 → 自然语言生成 → 实时预览 → 分享完整闭环 |
| **工程思维** | 明确 P0/P1/P2 优先级，6-8h 内聚焦主流程；技术选型成熟、文档清晰 |
| **用户体验** | 流式 Agent 输出、设备切换、代码视图、公开分享页，交互贴近 Atoms |
| **创新性** | 模式切换 / 版本历史 / 文件上传等可扩展点，展现产品迭代空间 |
| **可交付性** | 提供部署链接、GitHub 源码、说明文档模板 |

---

## 12. 不在范围内

- 真正的多 Agent 并行调度（用 System Prompt 模拟即可）。
- 自建代码执行服务（用 iframe/Sandpack 代替）。
- 付费功能（Stripe 集成）。
- 自定义域名与 SSL。
- SEO / 营销模块。

---

## 13. 结论

原 `SPEC.md` 的整体方向正确，能够覆盖笔试要求的主流程。本次校准后：

1. 明确对齐了笔试文档的 6-8 小时时间窗口和"借助 AI 工具快速交付原型"的导向；
2. 将技术栈版本更新为仓库实际使用的 **Next.js 16 + React 19**；
3. 增加了提交物、说明文档模板和评估维度自检，直接服务于最终评分；
4. 将模式切换等延展能力明确为 P1，确保至少覆盖"一个延展或衍生能力"的要求。

`SPEC.md` 已更新到项目根目录，可直接用于指导后续开发与提交。
