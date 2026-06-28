export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          status: 'idle' | 'generating' | 'done' | 'error'
          share_token: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          status?: 'idle' | 'generating' | 'done' | 'error'
          share_token?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          status?: 'idle' | 'generating' | 'done' | 'error'
          share_token?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          project_id: string
          role: 'user' | 'agent' | 'system'
          agent_name: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          role: 'user' | 'agent' | 'system'
          agent_name?: string | null
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          role?: 'user' | 'agent' | 'system'
          agent_name?: string | null
          content?: string
          created_at?: string
        }
      }
      code_snapshots: {
        Row: {
          id: string
          project_id: string
          message_id: string | null
          html_code: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          message_id?: string | null
          html_code: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          message_id?: string | null
          html_code?: string
          created_at?: string
        }
      }
    }
  }
}
