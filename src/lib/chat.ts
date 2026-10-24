export type ParsedRoom =
  | { kind: "global" }
  | { kind: "dm"; firstId: number; secondId: number; peerId: number }
  | { kind: "assignment"; assignmentId: number };

export function dmRoom(a: number, b: number): string {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return `dm:${low}:${high}`;
}

export function parseRoom(room: string, selfId?: number): ParsedRoom {
  if (room.startsWith("dm:")) {
    const [, a, b] = room.split(":");
    const firstId = Number(a);
    const secondId = Number(b);
    if (Number.isFinite(firstId) && Number.isFinite(secondId)) {
      const peerId =
        selfId !== undefined && firstId === selfId ? secondId : firstId;
      return { kind: "dm", firstId, secondId, peerId };
    }
  }
  if (room.startsWith("assignment:")) {
    const assignmentId = Number(room.split(":")[1]);
    if (Number.isFinite(assignmentId)) {
      return { kind: "assignment", assignmentId };
    }
  }
  return { kind: "global" };
}

export function roomKey(scope: "global" | "private" | "assignment", peerId?: number, assignmentId?: number): string {
  if (scope === "private" && peerId) return `dm-${peerId}`;
  if (scope === "assignment" && assignmentId) return `assignment-${assignmentId}`;
  return "global";
}
