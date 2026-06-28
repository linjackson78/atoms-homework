# Atoms Demo

一个 AI 驱动的 Web 应用构建平台，仿照 [atoms.dev](https://atoms.dev) 的核心体验构建。

## 功能特性

- **多 Agent 协同生成**：Emma（产品经理）、Bob（架构师）、Alex（工程师）流式输出
- **实时 App 预览**：生成的 HTML 应用在沙箱 iframe 中实时渲染
- **代码视图**：查看/复制生成的代码
- **移动端/桌面端预览切换**
- **用户认证**：注册/登录（Supabase Auth）
- **项目管理**：创建、保存、列表展示
- **数据持久化**：对话历史 + 代码快照（Supabase PostgreSQL）
- **发布/分享**：一键生成公开分享链接，展示构建过程

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **后端**: Next.js API Routes (Serverless)
- **数据库**: Supabase (PostgreSQL + Auth)
- **AI**: OpenAI gpt-4o-mini（流式 SSE）
- **部署**: Vercel

## 快速开始

### 1. 配置环境变量

复制 `.env.local` 并填入真实值：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
```

### 2. 初始化 Supabase 数据库

在 Supabase 控制台 SQL Editor 中执行 `supabase/schema.sql`

### 3. 本地运行

```bash
npm install
npm run dev
```

访问 http://localhost:3000

### 4. 部署到 Vercel

```bash
npx vercel --prod
```

在 Vercel Dashboard 中配置环境变量即可。

## 项目结构

```
app/
├── login/           # 登录页
├── register/        # 注册页
├── dashboard/       # 项目列表
├── workspace/       # 核心工作区（Chat + 预览）
│   └── [projectId]/
│       ├── WorkspaceClient.tsx  # 主交互组件
│       ├── AgentMessage.tsx     # Agent 消息渲染
│       └── AppPreview.tsx       # 应用预览（iframe）
├── share/           # 公开分享页（无需登录）
│   └── [token]/
└── api/
    ├── generate/    # AI 代码生成（SSE 流式）
    └── projects/    # 项目 CRUD + 分享
lib/
├── supabase/
│   ├── client.ts    # 浏览器端客户端
│   ├── server.ts    # 服务端客户端
│   └── types.ts     # 数据库类型
```
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
