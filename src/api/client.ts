import type {
  Assignment,
  Attachment,
  ChatOverview,
  LeaderboardEntry,
  LoginResponse,
  Message,
  PublicUser,
  Role,
  TeamMember,
  TeamOverview,
  UnreadRoom,
  UnreadSummary,
  UploadResult,
  User,
} from "./types";

/**
 * Production API. `EXPO_PUBLIC_API_URL` lets a development build point at a
 * LAN backend without touching code; the shipped default is the real domain.
 */
const configured = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
export const API_BASE = (
  configured || "https://archschool.vidxsepehr.ir/api"
).replace(/\/+$/, "");

export const ORIGIN = API_BASE.replace(/\/api$/, "");
export const WS_BASE = `${ORIGIN.replace(/^http/, "ws")}/api/ws`;

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function detailMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return typeof item === "string" ? item : "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" · ");
  }
  return fallback;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: BodyInit | null;
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true, timeoutMs = 20000, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      body: body ?? undefined,
      signal: controller.signal,
    });
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError");
    throw new ApiError(
      aborted
        ? "پاسخی از سرور نرسید. اتصال اینترنت را بررسی کنید."
        : "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.",
      0
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    unauthorizedHandler?.();
    throw new ApiError("نشست شما منقضی شده است. دوباره وارد شوید.", 401);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      detailMessage(payload, `درخواست ناموفق بود (HTTP ${response.status}).`),
      response.status
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export function login(username: string, code: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ username: username.trim(), code: code.trim().toUpperCase() }),
  });
}

export function register(username: string, code: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ username: username.trim(), code: code.trim().toUpperCase() }),
  });
}

export function fetchMe(): Promise<User> {
  return request<User>("/auth/me");
}

export function fetchUserProfile(id: number): Promise<User> {
  return request<User>(`/users/${id}/profile`);
}

export function updateMe(data: { bio?: string; avatar_url?: string | null }): Promise<User> {
  return request<User>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Push tokens
// ---------------------------------------------------------------------------
export function registerPushToken(token: string, deviceType: string): Promise<unknown> {
  return request("/users/push-token", {
    method: "POST",
    body: JSON.stringify({ token, device_type: deviceType }),
  });
}

export function unregisterPushToken(token: string): Promise<void> {
  return request<void>(`/users/push-token?token=${encodeURIComponent(token)}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Team + stats
// ---------------------------------------------------------------------------
export function fetchTeam(): Promise<PublicUser[]> {
  return request<PublicUser[]>("/users/team");
}

export function fetchOverview(): Promise<TeamOverview> {
  return request<TeamOverview>("/stats/overview");
}

export function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>("/stats/leaderboard");
}

export function fetchUserStats(userId: number): Promise<LeaderboardEntry> {
  return request<LeaderboardEntry>(`/stats/users/${userId}`);
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export function fetchAssignments(params?: {
  completed?: boolean;
  course?: string;
}): Promise<Assignment[]> {
  const search: string[] = [];
  if (params?.completed !== undefined) search.push(`completed=${params.completed}`);
  if (params?.course) search.push(`course=${encodeURIComponent(params.course)}`);
  return request<Assignment[]>(`/assignments/${search.length ? `?${search.join("&")}` : ""}`);
}

export function fetchAssignment(id: number): Promise<Assignment> {
  return request<Assignment>(`/assignments/${id}`);
}

export interface AssignmentInput {
  title: string;
  description?: string;
  course?: string;
  category?: string;
  subtype?: string;
  subject_id?: string;
  due_date?: string | null;
}

export function createAssignment(data: AssignmentInput): Promise<Assignment> {
  return request<Assignment>("/assignments/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function toggleAssignment(id: number): Promise<Assignment> {
  return request<Assignment>(`/assignments/${id}/toggle`, { method: "PATCH" });
}

export function deleteAssignment(id: number): Promise<void> {
  return request<void>(`/assignments/${id}`, { method: "DELETE" });
}

export function fetchAssignmentTeam(id: number): Promise<TeamMember[]> {
  return request<TeamMember[]>(`/assignments/${id}/team`);
}

export function fetchAttachments(id: number): Promise<Attachment[]> {
  return request<Attachment[]>(`/assignments/${id}/attachments`);
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export function fetchChatOverview(): Promise<ChatOverview> {
  return request<ChatOverview>("/messages/overview");
}

export function fetchMessages(params: {
  scope: "global" | "private" | "assignment";
  peerId?: number;
  assignmentId?: number;
  limit?: number;
}): Promise<Message[]> {
  const search = new URLSearchParams({ scope: params.scope });
  if (params.peerId) search.set("peer_id", String(params.peerId));
  if (params.assignmentId) search.set("assignment_id", String(params.assignmentId));
  if (params.limit) search.set("limit", String(params.limit));
  return request<Message[]>(`/messages/?${search.toString()}`);
}

export interface MessageInput {
  content?: string;
  receiver_id?: number | null;
  assignment_id?: number | null;
  file_url?: string | null;
  reply_to_id?: number | null;
}

export function sendMessage(data: MessageInput): Promise<Message> {
  return request<Message>("/messages/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteMessage(id: number): Promise<void> {
  return request<void>(`/messages/${id}`, { method: "DELETE" });
}

export function clearChat(params: {
  scope: "global" | "private" | "assignment";
  peerId?: number;
  assignmentId?: number;
}): Promise<void> {
  const search = new URLSearchParams({ scope: params.scope });
  if (params.peerId) search.set("peer_id", String(params.peerId));
  if (params.assignmentId) search.set("assignment_id", String(params.assignmentId));
  return request<void>(`/messages/clear?${search.toString()}`, { method: "DELETE" });
}

export function fetchRecentComments(limit = 6): Promise<Message[]> {
  return request<Message[]>(`/messages/recent-comments?limit=${limit}`);
}

export function fetchUnread(): Promise<UnreadSummary> {
  return request<UnreadSummary>("/messages/unread");
}

export function markRoomRead(room: string): Promise<UnreadRoom> {
  return request<UnreadRoom>(`/messages/${encodeURIComponent(room)}/read`, {
    method: "POST",
  });
}

export function pinMessage(id: number): Promise<Message> {
  return request<Message>(`/messages/${id}/pin`, { method: "POST" });
}

export function unpinMessage(id: number): Promise<Message> {
  return request<Message>(`/messages/${id}/pin`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Users (admin / owner)
// ---------------------------------------------------------------------------
export function fetchUsers(): Promise<User[]> {
  return request<User[]>("/users/");
}

export function createUser(data: {
  username: string;
  code?: string;
  role?: Role;
}): Promise<User> {
  return request<User>("/users/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateUser(
  id: number,
  data: { role?: Role; is_active?: boolean; username?: string }
): Promise<User> {
  return request<User>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateUserCode(id: number, code: string): Promise<User> {
  return request<User>(`/users/${id}/code`, {
    method: "PATCH",
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
}

export function deleteUser(id: number): Promise<void> {
  return request<void>(`/users/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Uploads + media
// ---------------------------------------------------------------------------
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function uploadFile(file: {
  uri: string;
  name: string;
  type: string;
  size?: number;
}): Promise<UploadResult> {
  if (file.size && file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError("حجم فایل نباید بیشتر از ۲۵ مگابایت باشد.", 413);
  }

  const form = new FormData();
  // React Native accepts this `{uri,name,type}` object and streams the file.
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let response: Response;
  try {
    response = await fetch(apiUrl("/uploads/"), {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("آپلود فایل ناموفق بود. اتصال یا حجم فایل را بررسی کنید.", 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    unauthorizedHandler?.();
    throw new ApiError("نشست شما منقضی شده است. دوباره وارد شوید.", 401);
  }
  if (!response.ok) {
    if (response.status === 413) {
      throw new ApiError("حجم فایل از حد مجاز سرور بیشتر است (حداکثر ۲۵ مگابایت).", 413);
    }
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      detailMessage(payload, "آپلود فایل ناموفق بود."),
      response.status
    );
  }
  return (await response.json()) as UploadResult;
}

const mediaCache = new Map<string, string>();

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  const cached = mediaCache.get(url);
  if (cached !== undefined) return cached;

  let resolved = url;
  if (/^https?:\/\//i.test(url)) resolved = url;
  else if (url.startsWith("/")) resolved = `${ORIGIN}${url}`;
  else resolved = `${ORIGIN}/${url}`;

  if (mediaCache.size > 1500) mediaCache.clear();
  mediaCache.set(url, resolved);
  return resolved;
}

export function roomSocketUrl(room: string, token: string): string {
  return `${WS_BASE}?token=${encodeURIComponent(token)}&room=${encodeURIComponent(room)}`;
}

/** Server-shaped React Query keys, so invalidations never miss a variant. */
export const qk = {
  me: ["me"] as const,
  overview: ["overview"] as const,
  leaderboard: ["leaderboard"] as const,
  userStats: (id: number) => ["user-stats", id] as const,
  assignments: ["assignments"] as const,
  assignment: (id: number) => ["assignment", id] as const,
  assignmentTeam: (id: number) => ["assignment-team", id] as const,
  attachments: (id: number) => ["attachments", id] as const,
  chatOverview: ["chat-overview"] as const,
  messages: (key: string) => ["messages", key] as const,
  unread: ["unread"] as const,
  recentComments: ["recent-comments"] as const,
  users: ["users"] as const,
  team: ["team"] as const,
};
