import type { Role, User } from "@/api/types";

export function isStaff(user: User | null | undefined): boolean {
  return Boolean(
    user && (user.is_admin || user.role === "admin" || user.role === "owner")
  );
}

export function isOwner(user: User | null | undefined): boolean {
  return user?.role === "owner";
}

/** Members are chat-locked everywhere except assignment comment rooms. */
export function canChat(user: User | null | undefined): boolean {
  return Boolean(
    user &&
      (user.is_admin || user.role === "admin" || user.role === "owner" || user.role === "friend")
  );
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "ادمین",
  friend: "فرند",
  member: "عضو",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "دسترسی کامل + آمار سرور",
  admin: "مدیریت تکالیف، کاربران و گفتگو",
  friend: "گفتگو و کامنت، بدون مدیریت",
  member: "مشاهدهٔ تکالیف و کامنت",
};

export function roleLabel(role: Role | undefined | null): string {
  return role ? (ROLE_LABEL[role] ?? role) : "عضو";
}

export function roleColor(role: Role | undefined | null): string {
  switch (role) {
    case "owner":
      return "amber";
    case "admin":
      return "blue";
    case "friend":
      return "teal";
    default:
      return "muted";
  }
}
