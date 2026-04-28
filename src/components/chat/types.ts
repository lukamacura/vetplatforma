export type MsgType = "text" | "image" | "video" | "voice"

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string | null
  message_type: MsgType
  file_url: string | null
  file_name: string | null
  duration_seconds: number | null
  is_read: boolean
  created_at: string
}
