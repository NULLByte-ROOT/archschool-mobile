export type Role = "owner" | "admin" | "friend" | "member";

export interface User {
  id: number;
  username: string;
  is_admin: boolean;
  role: Role;
  is_active: boolean;
  avatar_url?: string | null;
  bio?: string;
  last_seen?: string | null;
  created_at: string;
  code?: string;
}

export interface PublicUser {
  id: number;
  username: string;
  is_admin: boolean;
  role?: Role;
  avatar_url?: string | null;
}

export interface DailyActivity {
  date: string;
  count: number;
}

export interface LeaderboardEntry {
  user: PublicUser;
  rank: number;
  completion_percentage: number;
  completed_count: number;
  total_assignments: number;
  last_completion_time: string | null;
  average_speed_hours: number | null;
  weekly_activity: DailyActivity[];
  strongest_subject: string | null;
  weakest_subject: string | null;
  current_streak: number;
  best_streak: number;
  completed_today: boolean;
}

export interface TeamOverview {
  me: LeaderboardEntry;
  top_users: LeaderboardEntry[];
  team_record_streak: number;
  total_assignments: number;
  total_completions: number;
  active_users: number;
  class_completion_percentage: number;
  weekly_trend: DailyActivity[];
}

export interface CompletedByUser {
  id: number;
  username: string | null;
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  course: string;
  category: string;
  subtype: string;
  subject_id: string;
  due_date: string | null;
  completed: boolean;
  owner_id: number | null;
  creator_id: number | null;
  creator_username: string | null;
  completed_by_users: CompletedByUser[];
  is_completed_by_me: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  user: PublicUser;
  completed: boolean;
  is_self: boolean;
}

export interface ReplyPreview {
  id: number;
  sender_id: number;
  sender_username: string | null;
  content: string;
  file_url: string | null;
}

export interface Message {
  id: number;
  sender_id: number;
  sender_username: string | null;
  sender_avatar_url?: string | null;
  receiver_id: number | null;
  assignment_id: number | null;
  assignment_title?: string | null;
  content: string;
  file_url: string | null;
  reply_to: ReplyPreview | null;
  is_pinned: boolean;
  created_at: string;
}

export interface Attachment {
  id: number;
  assignment_id: number;
  user_id: number;
  user_username: string | null;
  uploader?: PublicUser | null;
  file_url: string;
  file_name: string;
  created_at: string;
}

export interface UploadResult {
  url: string;
  file_name: string;
  size: number;
}

export interface DirectPreview {
  peer_id: number;
  message: Message;
}

export interface ChatOverview {
  global_message: Message | null;
  directs: DirectPreview[];
}

export interface UnreadRoom {
  room: string;
  unread_count: number;
}

export interface UnreadSummary {
  rooms: UnreadRoom[];
  total: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
