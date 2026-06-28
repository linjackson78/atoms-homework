import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 60

const TEAM_SYSTEM_PROMPT = `You are an AI application builder. When given a user's description, you will:

1. First respond as Emma (Product Manager): Briefly analyze the requirements in 2-3 sentences
2. Then respond as Bob (Architect): Briefly describe the technical approach in 2-3 sentences  
3. Then respond as Alex (Engineer): Say you're starting to write the code, then output a SINGLE complete HTML file

The HTML file must:
- Be a complete, self-contained single HTML file with inline CSS and JavaScript
- Include Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Have a beautiful, modern dark-themed UI
- Be fully functional and interactive (use localStorage for data persistence)
- Include realistic placeholder data/content
- Be responsive and mobile-friendly

Format your response EXACTLY like this:
[EMMA] Your product analysis here...

[BOB] Your architecture description here...

[ALEX] Starting to build your app now...

\`\`\`html
<!DOCTYPE html>
<html>
... complete HTML code ...
</html>
\`\`\`

After the code, briefly describe what was built in 1-2 sentences as Alex.

IMPORTANT: The HTML must be complete and runnable. Use Tailwind CSS classes for styling.`

const ENGINEER_SYSTEM_PROMPT = `You are Alex, an expert frontend engineer. The user will describe what they want, and you should directly write the code.

Start your response with [ALEX] and immediately begin coding. Do NOT include any analysis from Emma or Bob — you are the only agent.

The HTML file must:
- Be a complete, self-contained single HTML file with inline CSS and JavaScript
- Include Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Have a beautiful, modern dark-themed UI
- Be fully functional and interactive (use localStorage for data persistence)
- Include realistic placeholder data/content
- Be responsive and mobile-friendly

Format your response EXACTLY like this:
[ALEX] Starting to build your app now...

\`\`\`html
<!DOCTYPE html>
<html>
... complete HTML code ...
</html>
\`\`\`

After the code, briefly describe what was built in 1-2 sentences as Alex.

IMPORTANT: The HTML must be complete and runnable. Use Tailwind CSS classes for styling.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { projectId, prompt, conversationHistory = [], mode = 'team' } = await req.json() as {
    projectId?: string
    prompt?: string
    conversationHistory?: Array<{ role: string; content: string }>
    mode?: 'team' | 'engineer'
  }

  if (!projectId || !prompt) {
    return new Response('Missing required fields', { status: 400 })
  }

  // 保存用户消息
  await supabase.from('messages').insert({
    project_id: projectId,
    role: 'user',
    content: prompt,
  })

  // 更新项目状态
  await supabase.from('projects').update({ status: 'generating' }).eq('id', projectId)

  const systemPrompt = mode === 'engineer' ? ENGINEER_SYSTEM_PROMPT : TEAM_SYSTEM_PROMPT

  // 构建对话历史
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((m: { role: string; content: string }) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: prompt },
  ]

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  })

  // 创建 ReadableStream 流式响应
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'moonshot-v1-8k',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 8000,
        })

        let fullContent = ''
        let currentAgent = ''
        let buffer = ''

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content || ''
          fullContent += delta
          buffer += delta

          // 检测 Agent 标签切换
          const agentMatch = buffer.match(/\[(EMMA|BOB|ALEX)\]/)
          if (agentMatch) {
            const agent = agentMatch[1]
            if (agent !== currentAgent) {
              currentAgent = agent
              sendEvent({ type: 'agent_switch', agent })
            }
          }

          // 流式发送 token
          if (delta) {
            sendEvent({ type: 'token', content: delta })
          }
        }

        // 解析最终内容
        const htmlMatch = fullContent.match(/```html\n?([\s\S]*?)```/)
        const htmlCode = htmlMatch?.[1]?.trim() || null

        // 存储 AI 消息
        const { data: savedMsg } = await supabase.from('messages').insert({
          project_id: projectId,
          role: 'agent',
          agent_name: mode === 'engineer' ? 'alex' : 'team',
          content: fullContent,
        }).select().single()

        // 存储代码快照
        if (htmlCode) {
          await supabase.from('code_snapshots').insert({
            project_id: projectId,
            message_id: savedMsg?.id,
            html_code: htmlCode,
          })

          // 从 prompt 生成项目名
          const projectName = prompt.length > 40
            ? prompt.substring(0, 40) + '...'
            : prompt

          await supabase.from('projects').update({
            status: 'done',
            name: projectName,
          }).eq('id', projectId)
        } else {
          await supabase.from('projects').update({ status: 'done' }).eq('id', projectId)
        }

        sendEvent({ type: 'done', hasCode: !!htmlCode, code: htmlCode })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))

      } catch (error) {
        console.error('Generation error:', error)
        await supabase.from('projects').update({ status: 'error' }).eq('id', projectId)
        sendEvent({ type: 'error', message: 'Generation failed. Please try again.' })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
