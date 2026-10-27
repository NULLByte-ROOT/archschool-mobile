import type {
  Assignment,
  Attachment,
  ChatOverview,
  LeaderboardEntry,
  LoginResponse,
  Message,
  NotificationPreferences,
  PublicUser,
  ReadBatchResult,
  Role,
  SchoolPeriod,
  SchoolSchedule,
  TeamMember,
  TeamOverview,
  UnreadRoom,
  UnreadSummary,
  UploadResult,
  User,
} from "./types";
import * as FileSystem from "expo-file-system/legacy";

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

/** Mirrors the web `deleteMyAvatar()`; also removes the uploaded file server-side. */
export function deleteMyAvatar(): Promise<User> {
  return request<User>("/users/me/avatar", { method: "DELETE" });
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

/** Server-side notification switches for this device (Settings page). */
export function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/users/push-token/preferences");
}

export function updateNotificationPreferences(
  prefs: NotificationPreferences,
  token?: string | null
): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/users/push-token/preferences", {
    method: "PATCH",
    body: JSON.stringify({
      chat: prefs.chat,
      assignments: prefs.assignments,
      deadlines: prefs.deadlines,
      token: token || null,
    }),
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

export function fetchSchoolSchedule(): Promise<SchoolSchedule> {
  return request<SchoolSchedule>("/schedule");
}

/** Admin/owner only: replace all four bells atomically. */
export function updateSchoolSchedule(
  periods: SchoolPeriod[]
): Promise<SchoolSchedule> {
  return request<SchoolSchedule>("/schedule", {
    method: "PUT",
    body: JSON.stringify({ periods }),
  });
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

/**
 * Assignments whose due date has passed — completed ones included. Mirrors the
 * web `fetchOverdueAssignments`; the API route is registered before
 * `/assignments/{id}` so "overdue" never hits the integer path parameter.
 */
export function fetchOverdueAssignments(): Promise<Assignment[]> {
  return request<Assignment[]>("/assignments/overdue");
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

export function updateAssignment(id: number, data: AssignmentInput): Promise<Assignment> {
  return request<Assignment>(`/assignments/${id}`, {
    method: "PATCH",
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

export function deleteAttachment(attachmentId: number): Promise<void> {
  return request<void>(`/attachments/${attachmentId}`, { method: "DELETE" });
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

export function editMessage(id: number, content: string): Promise<Message> {
  return request<Message>(`/messages/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
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
  return request<UnreadRoom>(`/messages/rooms/${encodeURIComponent(room)}/read`, {
    method: "POST",
  });
}

/**
 * Mark every unseen message of a room as read (ticks + unread bookmark in one
 * call). Mirrors the web client's `readRoomBatch`.
 */
export function readRoomBatch(room: string, upToId?: number): Promise<ReadBatchResult> {
  return request<ReadBatchResult>("/messages/read-batch", {
    method: "POST",
    body: JSON.stringify({ room, up_to_id: upToId ?? null }),
  });
}

/** Record a single receipt (a message that arrived while the room was open). */
export function markMessageRead(id: number): Promise<Message> {
  return request<Message>(`/messages/${id}/read`, { method: "POST" });
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

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  bmp: "image/bmp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]{1,6})$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

/** Pick a trustworthy MIME type: declared type, then extension, then path. */
function uploadMimeType(declared: string | undefined, name: string, uri: string): string {
  const candidate = (declared || "").trim().toLowerCase();
  if (candidate && candidate !== "application/octet-stream") return candidate;
  for (const value of [name, uri]) {
    const ext = extensionOf(value.split("?")[0] ?? "");
    if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  }
  return "image/jpeg";
}

/** A multipart part needs a filename the server can derive an extension from. */
function uploadName(declared: string | undefined, uri: string, mime: string): string {
  const cleaned = (declared || "").trim().replace(/[\\/:*?"<>|]+/g, "-");
  if (cleaned && extensionOf(cleaned)) return cleaned;
  const fallbackExt =
    Object.entries(MIME_BY_EXT).find(([, value]) => value === mime)?.[0] ?? "jpg";
  const tail = uri.split("?")[0]?.split("/").pop() ?? "";
  if (tail && extensionOf(tail) && !tail.startsWith(".")) return tail;
  return `upload-${Date.now()}.${fallbackExt}`;
}

function uploadError(status: number, body: string): ApiError {
  let detail = "";
  try {
    detail = detailMessage(JSON.parse(body), "");
  } catch {
    detail = body.slice(0, 200);
  }
  if (status === 413) {
    return new ApiError("حجم فایل از حد مجاز سرور بیشتر است (حداکثر ۲۵ مگابایت).", 413);
  }
  return new ApiError(detail || "آپلود فایل ناموفق بود.", status);
}

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

/**
 * Upload one picked file to any multipart endpoint.
 *
 * Two transports on purpose:
 *  1. `expo-file-system`'s native multipart uploader — it streams from the
 *     photo-picker cache with OkHttp/NSURLSession, so neither a `content://`
 *     URI nor a JS-side `FormData` polyfill quirk can break it. This is what
 *     made "pick an image → Send" fail instantly before.
 *  2. The classic RN `FormData` request, kept as a fallback for any URI the
 *     native uploader refuses.
 */
async function uploadTo<T>(path: string, file: PickedFile): Promise<T> {
  if (file.size && file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError("حجم فایل نباید بیشتر از ۲۵ مگابایت باشد.", 413);
  }

  const mime = uploadMimeType(file.type, file.name, file.uri);
  const name = uploadName(file.name, file.uri, mime);
  const endpoint = apiUrl(path);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  try {
    const result = await FileSystem.uploadAsync(endpoint, file.uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: mime,
      headers,
    });
    if (result.status === 401) {
      unauthorizedHandler?.();
      throw new ApiError("نشست شما منقضی شده است. دوباره وارد شوید.", 401);
    }
    if (result.status < 200 || result.status >= 300) {
      throw uploadError(result.status, result.body ?? "");
    }
    return JSON.parse(result.body) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Fall through to the JS transport below.
  }

  const form = new FormData();
  // React Native accepts this `{uri,name,type}` object and streams the file.
  form.append("file", {
    uri: file.uri,
    name,
    type: mime,
  } as unknown as Blob);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let response: Response;
  try {
    response = await fetch(endpoint, {
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
    const payload = await response.json().catch(() => null);
    if (response.status === 413) {
      throw new ApiError("حجم فایل از حد مجاز سرور بیشتر است (حداکثر ۲۵ مگابایت).", 413);
    }
    throw new ApiError(
      detailMessage(payload, "آپلود فایل ناموفق بود."),
      response.status
    );
  }
  return (await response.json()) as T;
}

/** Upload an avatar / chat image / comment image. */
export function uploadFile(file: PickedFile): Promise<UploadResult> {
  return uploadTo<UploadResult>("/uploads", file);
}

/** Upload a file straight onto an assignment (web: `POST /assignments/{id}/attachments`). */
export function addAttachment(
  assignmentId: number,
  file: PickedFile
): Promise<Attachment> {
  return uploadTo<Attachment>(`/assignments/${assignmentId}/attachments`, file);
}

const mediaCache = new Map<string, string>();

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  const cached = mediaCache.get(url);
  if (cached !== undefined) return cached;

  let resolved = url;
  if (/^(https?|file|content|data|blob):/i.test(url)) resolved = url;
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
  user: (id: number) => ["user", id] as const,
  overview: ["overview"] as const,
  leaderboard: ["leaderboard"] as const,
  schedule: ["school-schedule"] as const,
  userStats: (id: number) => ["user-stats", id] as const,
  assignments: ["assignments"] as const,
  overdue: ["assignments-overdue"] as const,
  assignment: (id: number) => ["assignment", id] as const,
  assignmentTeam: (id: number) => ["assignment-team", id] as const,
  attachments: (id: number) => ["attachments", id] as const,
  chatOverview: ["chat-overview"] as const,
  messages: (key: string) => ["messages", key] as const,
  unread: ["unread"] as const,
  recentComments: ["recent-comments"] as const,
  users: ["users"] as const,
  team: ["team"] as const,
  notificationPrefs: ["notification-prefs"] as const,
};
