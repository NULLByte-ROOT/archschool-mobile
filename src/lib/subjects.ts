/**
 * The class's fixed subject list, mirrored from the web client's data module.
 *
 * Assignments carry both a human-readable `course` and a stable `subject_id`;
 * the timetable and per-subject grouping rely on the id, so mobile creation
 * must use the same ids as the web app rather than free text.
 */
export interface Subject {
  id: string;
  name: string;
  nameEn: string;
  teacher: string;
}

export const SUBJECT_LIST: Subject[] = [
  { id: "web-design", name: "طراحی وب", nameEn: "Web Design", teacher: "محمدی‌فر" },
  { id: "persian", name: "فارسی", nameEn: "Persian", teacher: "عسگری" },
  {
    id: "human-env",
    name: "انسان و محیط زیست",
    nameEn: "Human & Environment",
    teacher: "عزیزی",
  },
  { id: "religion", name: "دین و زندگی", nameEn: "Religion", teacher: "داوودی" },
  { id: "sports", name: "تربیت بدنی", nameEn: "Sports", teacher: "عزیزی" },
  { id: "arabic", name: "عربی", nameEn: "Arabic", teacher: "داوودی" },
  {
    id: "entrepreneurship",
    name: "کارآفرینی",
    nameEn: "Entrepreneurship",
    teacher: "مجیدی",
  },
  { id: "history", name: "تاریخ", nameEn: "History", teacher: "نظم‌ده" },
  { id: "english", name: "زبان انگلیسی", nameEn: "English", teacher: "علمدار" },
  {
    id: "content-creation",
    name: "تولید محتوای کامپیوتری",
    nameEn: "Computer Content Creation",
    teacher: "حیدری",
  },
  {
    id: "production-mgmt",
    name: "مدیریت تولید",
    nameEn: "Production Management",
    teacher: "م. محمدی",
  },
  {
    id: "media-literacy",
    name: "تفکر و سواد رسانه‌ای",
    nameEn: "Thinking & Media Literacy",
    teacher: "محمدی",
  },
  { id: "math", name: "ریاضی", nameEn: "Math", teacher: "یوسفی" },
  { id: "chemistry", name: "شیمی", nameEn: "Chemistry", teacher: "گل‌محمدی" },
];

export const SUBJECT_BY_ID: Record<string, Subject> = Object.fromEntries(
  SUBJECT_LIST.map((subject) => [subject.id, subject])
);

export function subjectName(id: string, fallback = ""): string {
  return SUBJECT_BY_ID[id]?.name ?? fallback;
}

export interface CategoryItem {
  id: string;
  label: string;
}

export interface CategoryGroup {
  id: string;
  label: string;
  items: CategoryItem[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: "homework",
    label: "تکلیف",
    items: [
      { id: "written", label: "نوشتنی" },
      { id: "practical", label: "پروژه عملی" },
      { id: "research", label: "تحقیق" },
    ],
  },
  {
    id: "exam",
    label: "امتحان",
    items: [
      { id: "oral", label: "پرسش شفاهی" },
      { id: "written_exam", label: "کتبی" },
      { id: "podmani", label: "پودمانی" },
      { id: "term1", label: "نوبت اول" },
      { id: "term2", label: "نوبت دوم" },
      { id: "question", label: "پرسش" },
    ],
  },
];

export function categoryGroup(id: string): CategoryGroup | undefined {
  return CATEGORY_GROUPS.find((group) => group.id === id);
}

export function categoryItemLabel(subtype: string): string {
  for (const group of CATEGORY_GROUPS) {
    const item = group.items.find((entry) => entry.id === subtype);
    if (item) return item.label;
  }
  return subtype;
}

export function categoryTitle(category: string, subtype: string): string {
  const group = categoryGroup(category);
  const item = categoryItemLabel(subtype);
  if (group && item) return `${group.label} · ${item}`;
  return group?.label ?? item ?? "";
}
