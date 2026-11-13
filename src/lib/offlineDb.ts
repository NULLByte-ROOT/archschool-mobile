import * as FileSystem from "expo-file-system/legacy";
import type { Assignment, SchoolPeriod } from "@/api/types";
import type { Day } from "./timetable";

const DB_DIR = `${FileSystem.documentDirectory ?? ""}archschool_offline/`;

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DB_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(DB_DIR, { intermediates: true });
    }
  } catch {
    // Directory check best-effort
  }
}

async function readFile<T>(filename: string, fallback: T): Promise<T> {
  try {
    await ensureDir();
    const uri = `${DB_DIR}${filename}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return fallback;
    const content = await FileSystem.readAsStringAsync(uri);
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeFile<T>(filename: string, data: T): Promise<void> {
  try {
    await ensureDir();
    const uri = `${DB_DIR}${filename}`;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(data));
  } catch {
    // write error best-effort
  }
}

export const offlineDb = {
  // Timetable
  async getTimetable(): Promise<Day[] | null> {
    return readFile<Day[] | null>("timetable.json", null);
  },
  async saveTimetable(timetable: Day[]): Promise<void> {
    await writeFile("timetable.json", timetable);
  },

  // Bell Periods
  async getSchedule(): Promise<SchoolPeriod[] | null> {
    return readFile<SchoolPeriod[] | null>("schedule.json", null);
  },
  async saveSchedule(periods: SchoolPeriod[]): Promise<void> {
    await writeFile("schedule.json", periods);
  },

  // Assignments
  async getAssignments(): Promise<Assignment[]> {
    return readFile<Assignment[]>("assignments.json", []);
  },
  async saveAssignments(assignments: Assignment[]): Promise<void> {
    await writeFile("assignments.json", assignments);
  },
  async addOrUpdateAssignment(item: Assignment): Promise<void> {
    const list = await this.getAssignments();
    const idx = list.findIndex((a) => a.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    await this.saveAssignments(list);
  },
  async toggleAssignmentCompletion(id: number): Promise<Assignment | null> {
    const list = await this.getAssignments();
    const target = list.find((a) => a.id === id);
    if (!target) return null;
    target.completed = !target.completed;
    target.is_completed_by_me = target.completed;
    await this.saveAssignments(list);
    return target;
  },

  // Solo mode vs Classroom
  async isSoloMode(): Promise<boolean> {
    return readFile<boolean>("is_solo_mode.json", false);
  },
  async setSoloMode(enabled: boolean): Promise<void> {
    await writeFile("is_solo_mode.json", enabled);
  },

  // Selected Classroom ID
  async getActiveRoomId(): Promise<number | null> {
    return readFile<number | null>("active_room.json", null);
  },
  async setActiveRoomId(id: number | null): Promise<void> {
    await writeFile("active_room.json", id);
  },
};
