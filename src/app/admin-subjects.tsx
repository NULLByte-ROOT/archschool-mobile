import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchSchoolConfig,
  qk,
  type SchoolConfigResponse,
  type SchoolSubjectConfig,
  updateSchoolConfig,
} from "@/api/client";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { Kicker, MonoLabel, Panel } from "@/components/webui";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

export default function AdminSubjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const staff = user && (user.is_admin || user.role === "admin" || user.role === "owner");

  const query = useQuery({
    queryKey: qk.schoolConfig,
    queryFn: fetchSchoolConfig,
    enabled: Boolean(staff),
  });

  const [activeTab, setActiveTab] = useState<"subjects" | "categories">("subjects");

  // Local draft state
  const [subjects, setSubjects] = useState<SchoolSubjectConfig[]>([]);
  const [categories, setCategories] = useState<SchoolConfigResponse["categories"]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<SchoolConfigResponse["weekly_schedule"]>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Modal / Add state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newSubjName, setNewSubjName] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newSubjId, setNewSubjId] = useState("");
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<string>("homework");
  const [newTopicLabel, setNewTopicLabel] = useState("");

  if (query.data && !isInitialized) {
    setSubjects(query.data.subjects || []);
    setCategories(query.data.categories || []);
    setWeeklySchedule(query.data.weekly_schedule || {});
    setIsInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: SchoolConfigResponse) => updateSchoolConfig(payload),
    onSuccess: (data) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.setQueryData(qk.schoolConfig, data);
      void queryClient.invalidateQueries({ queryKey: qk.schedule });
      Alert.alert("موفقیت", "تنظیمات دروس و اساتید با موفقیت در کل سامانه ذخیره و اعمال شد!");
    },
    onError: (err: any) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطا در ذخیره", err?.message || "خطایی رخ داد.");
    },
  });

  const handleSaveAll = () => {
    saveMutation.mutate({
      subjects,
      categories,
      weekly_schedule: weeklySchedule,
    });
  };

  const handleAddOrEditSubject = () => {
    if (!newSubjName.trim()) {
      Alert.alert("خطا", "لطفاً نام درس را وارد کنید.");
      return;
    }
    const cleanId = newSubjId.trim() || newSubjName.trim().replace(/\s+/g, "-").toLowerCase();

    if (editingIndex !== null) {
      // Edit
      const updated = [...subjects];
      updated[editingIndex] = {
        id: cleanId,
        name: newSubjName.trim(),
        teacher: newTeacherName.trim(),
      };
      setSubjects(updated);
      setEditingIndex(null);
    } else {
      // Add
      setSubjects((prev) => [
        ...prev,
        {
          id: cleanId,
          name: newSubjName.trim(),
          teacher: newTeacherName.trim(),
        },
      ]);
    }

    setNewSubjName("");
    setNewTeacherName("");
    setNewSubjId("");
    setIsAddingSubject(false);
  };

  const handleDeleteSubject = (index: number) => {
    Alert.alert(
      "حذف درس",
      `آیا از حذف درس «${subjects[index].name}» اطمینان دارید؟`,
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => {
            setSubjects((prev) => prev.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  const handleAddTopic = () => {
    if (!newTopicLabel.trim()) return;
    const label = newTopicLabel.trim();
    const id = label.replace(/\s+/g, "_").toLowerCase();

    setCategories((prev) =>
      prev.map((grp) => {
        if (grp.id === selectedGroupId) {
          if (grp.items.some((it) => it.label === label)) return grp;
          return { ...grp, items: [...grp.items, { id, label }] };
        }
        return grp;
      })
    );
    setNewTopicLabel("");
  };

  const handleDeleteTopic = (groupId: string, topicId: string) => {
    setCategories((prev) =>
      prev.map((grp) => {
        if (grp.id === groupId) {
          return { ...grp, items: grp.items.filter((it) => it.id !== topicId) };
        }
        return grp;
      })
    );
  };

  if (!staff) {
    return (
      <Screen>
        <Header title="دسترسی غیرمجاز" onBack={() => router.back()} />
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={48} color={colors.danger} />
          <AppText variant="title" style={{ marginTop: 16 }}>
            دسترسی محدود
          </AppText>
          <AppText color={colors.faint} align="center" style={{ marginTop: 8 }}>
            این صفحه فقط برای ادمین و مدیر مدرسه باز است.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="مدیریت دروس، اساتید و موضوعات"
        subtitle="تعریف و ویرایش ماژولار برنامه درسی و دبیران"
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 60 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Tabs */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab("subjects")}
              style={[styles.tabItem, activeTab === "subjects" && styles.tabItemActive]}
            >
              <Ionicons
                name="book-outline"
                size={16}
                color={activeTab === "subjects" ? colors.amber : colors.faint}
              />
              <AppText
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 13,
                  color: activeTab === "subjects" ? colors.amber : colors.faint,
                }}
              >
                دروس و اساتید ({subjects.length})
              </AppText>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("categories")}
              style={[styles.tabItem, activeTab === "categories" && styles.tabItemActive]}
            >
              <Ionicons
                name="pricetags-outline"
                size={16}
                color={activeTab === "categories" ? colors.amber : colors.faint}
              />
              <AppText
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 13,
                  color: activeTab === "categories" ? colors.amber : colors.faint,
                }}
              >
                موضوعات و دسته‌ها ({categories.length})
              </AppText>
            </Pressable>
          </View>

          {query.isLoading && !isInitialized ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.amber} />
              <AppText color={colors.faint} style={{ marginTop: 12, fontSize: 12 }}>
                در حال بارگذاری اطلاعات مدرسه...
              </AppText>
            </View>
          ) : activeTab === "subjects" ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Kicker text="curriculum subjects" dot />
                <Pressable
                  onPress={() => {
                    setEditingIndex(null);
                    setNewSubjName("");
                    setNewTeacherName("");
                    setNewSubjId("");
                    setIsAddingSubject(true);
                  }}
                  style={styles.addMiniBtn}
                >
                  <Ionicons name="add" size={16} color={colors.white} />
                  <AppText style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.white }}>
                    افزودن درس جدید
                  </AppText>
                </Pressable>
              </View>

              {/* Add / Edit Form */}
              {isAddingSubject ? (
                <Panel corners contentStyle={styles.formPanel} style={{ marginBottom: 16 }}>
                  <MonoLabel style={{ marginBottom: 8 }}>
                    {editingIndex !== null ? "// ویرایش درس" : "// تعریف درس جدید"}
                  </MonoLabel>

                  <View style={styles.inputGroup}>
                    <AppText variant="caption" color={colors.faint} style={styles.label}>
                      نام درس (فارسی)
                    </AppText>
                    <TextInput
                      value={newSubjName}
                      onChangeText={setNewSubjName}
                      placeholder="مثلاً طراحی وب یا فیزیک..."
                      placeholderTextColor={colors.faint}
                      style={styles.textInput}
                      textAlign="right"
                    />
                  </View>

                  <View style={[styles.inputGroup, { marginTop: 10 }]}>
                    <AppText variant="caption" color={colors.faint} style={styles.label}>
                      نام دبیر / استاد
                    </AppText>
                    <TextInput
                      value={newTeacherName}
                      onChangeText={setNewTeacherName}
                      placeholder="مثلاً محمدی‌فر، یوسفی..."
                      placeholderTextColor={colors.faint}
                      style={styles.textInput}
                      textAlign="right"
                    />
                  </View>

                  <View style={[styles.inputGroup, { marginTop: 10 }]}>
                    <AppText variant="caption" color={colors.faint} style={styles.label}>
                      شناسه انگلیسی (اختیاری)
                    </AppText>
                    <TextInput
                      value={newSubjId}
                      onChangeText={setNewSubjId}
                      placeholder="مثلاً web-design یا physics..."
                      placeholderTextColor={colors.faint}
                      style={[styles.textInput, { textAlign: "left" }]}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.formActions}>
                    <Button
                      label="انصراف"
                      variant="ghost"
                      onPress={() => {
                        setIsAddingSubject(false);
                        setEditingIndex(null);
                      }}
                    />
                    <Button
                      label={editingIndex !== null ? "اعمال تغییرات" : "افزودن درس"}
                      variant="primary"
                      onPress={handleAddOrEditSubject}
                    />
                  </View>
                </Panel>
              ) : null}

              {/* Subjects List */}
              <View style={{ gap: 8 }}>
                {subjects.map((subj, index) => (
                  <Panel key={`${subj.id}-${index}`} corners contentStyle={styles.subjRow}>
                    <View style={styles.subjIconTile}>
                      <Ionicons name="book" size={18} color={colors.amber} />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 20 }}>
                        {subj.name}
                      </AppText>
                      <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 16 }}>
                        استاد: {subj.teacher || "ثبت نشده"} · شناسه: {subj.id}
                      </AppText>
                    </View>

                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => {
                          setEditingIndex(index);
                          setNewSubjName(subj.name);
                          setNewTeacherName(subj.teacher);
                          setNewSubjId(subj.id);
                          setIsAddingSubject(true);
                        }}
                        style={styles.actionIconBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="pencil" size={15} color={colors.textSoft} />
                      </Pressable>

                      <Pressable
                        onPress={() => handleDeleteSubject(index)}
                        style={styles.actionIconBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.danger} />
                      </Pressable>
                    </View>
                  </Panel>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.sectionHeaderRow}>
                <Kicker text="topics & categories" dot />
              </View>

              {/* Group Selector */}
              <View style={[styles.tabBar, { marginBottom: 12 }]}>
                {categories.map((grp) => (
                  <Pressable
                    key={grp.id}
                    onPress={() => setSelectedGroupId(grp.id)}
                    style={[
                      styles.tabItem,
                      selectedGroupId === grp.id && styles.tabItemActive,
                    ]}
                  >
                    <AppText
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 12.5,
                        color: selectedGroupId === grp.id ? colors.amber : colors.faint,
                      }}
                    >
                      {grp.label} ({grp.items?.length || 0})
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <Panel corners contentStyle={styles.formPanel} style={{ marginBottom: 16 }}>
                <MonoLabel style={{ marginBottom: 8 }}>
                  // افزودن موضوع به دسته‌ی «{categories.find((g) => g.id === selectedGroupId)?.label || selectedGroupId}»
                </MonoLabel>
                <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                  <TextInput
                    value={newTopicLabel}
                    onChangeText={setNewTopicLabel}
                    placeholder="موضوع جدید (مثلاً پرسش مستمر، تحقیق...)"
                    placeholderTextColor={colors.faint}
                    style={[styles.textInput, { flex: 1 }]}
                    textAlign="right"
                  />
                  <Button
                    label="افزودن"
                    icon="add"
                    variant="primary"
                    onPress={handleAddTopic}
                  />
                </View>
              </Panel>

              {/* Categories & Topics Lists */}
              {categories.map((grp) => (
                <Panel key={grp.id} corners contentStyle={styles.catGroupPanel} style={{ marginBottom: 14 }}>
                  <View style={styles.catGroupHeader}>
                    <Ionicons name="folder-open-outline" size={16} color={colors.amber} />
                    <AppText style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>
                      دسته‌ی {grp.label} ({grp.items?.length || 0} موضوع)
                    </AppText>
                  </View>
                  <View style={styles.catGrid}>
                    {(grp.items || []).map((topic) => (
                      <View key={topic.id} style={styles.catPill}>
                        <AppText style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.white }}>
                          {topic.label}
                        </AppText>
                        <Pressable
                          onPress={() => handleDeleteTopic(grp.id, topic.id)}
                          hitSlop={6}
                          style={{ padding: 2 }}
                        >
                          <Ionicons name="close-circle" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </Panel>
              ))}
            </>
          )}

          {/* Save All Button Fixed at Bottom */}
          <View style={styles.saveWrap}>
            <Button
              label={saveMutation.isPending ? "در حال ذخیره‌سازی..." : "ذخیره نهایی در سامانه و هوش مصنوعی"}
              icon="save-outline"
              variant="primary"
              disabled={saveMutation.isPending}
              onPress={handleSaveAll}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
  },
  accessDenied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  tabBar: {
    flexDirection: "row-reverse",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 4,
    borderRadius: radius.md,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  tabItemActive: {
    backgroundColor: "rgba(255,179,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,179,0,0.3)",
  },
  sectionHeaderRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addMiniBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  formPanel: {
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  label: {
    marginBottom: 4,
    fontSize: 11,
  },
  inputGroup: {},
  textInput: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  formActions: {
    flexDirection: "row-reverse",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  subjRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  subjIconTile: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,179,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,179,0,0.25)",
  },
  rowActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: radius.xs,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  catGroupPanel: {
    padding: 12,
  },
  catGroupHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  catGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    padding: 14,
  },
  catPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  saveWrap: {
    marginTop: 24,
  },
});
