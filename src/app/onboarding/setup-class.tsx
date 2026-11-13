import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createClassroom, joinClassroom } from "@/api/client";
import { ThreeDFullScene } from "@/components/ThreeDFullScene";
import { offlineDb } from "@/lib/offlineDb";
import { colors } from "@/theme/tokens";

export default function SetupClass() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPadding = Math.max(insets.top, 24) + 16;
  const bottomPadding = Math.max(insets.bottom, 16) + 20;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals for Create and Join
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [className, setClassName] = useState("");
  const [classDesc, setClassDesc] = useState("");

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  // 1. Create Class Action
  const handleCreateSubmit = async () => {
    if (!className.trim()) {
      setError("لطفاً نام کلاس را وارد کنید.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const room = await createClassroom(className, classDesc);
      await offlineDb.setActiveRoomId(room.id);
      await offlineDb.setSoloMode(false);
      setShowCreateModal(false);
      router.replace("/(tabs)/home");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در ایجاد کلاس");
    } finally {
      setLoading(false);
    }
  };

  // 2. Join Class Action
  const handleJoinSubmit = async () => {
    if (!joinCode.trim() || joinCode.trim().length < 4) {
      setError("کد دعوت باید حداقل ۴ نویسه باشد.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const room = await joinClassroom(joinCode);
      await offlineDb.setActiveRoomId(room.id);
      await offlineDb.setSoloMode(false);
      setShowJoinModal(false);
      router.replace("/(tabs)/home");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "کد دعوت نامعتبر است");
    } finally {
      setLoading(false);
    }
  };

  // 3. Solo Mode Action ("فقط خودم")
  const handleSoloMode = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await offlineDb.setSoloMode(true);
    await offlineDb.setActiveRoomId(null);
    router.replace("/(tabs)/home");
  };

  return (
    <View style={[styles.safe, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      <View style={styles.container}>
        {/* Top Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>گام نهایی</Text>
          </View>
          <Text style={styles.headerTitle}>محیط همکاری و رقابت کلاسی</Text>
        </Animated.View>

        {/* 3D Masterpiece Canvas */}
        <View style={styles.canvasContainer}>
          <ThreeDFullScene type={2} />
          <View style={styles.dragHintBox}>
            <Text style={styles.dragHint}>
              <Ionicons name="sparkles" size={12} color={colors.emerald} /> برای چرخش لمس کنید و بچرخانید
            </Text>
          </View>
        </View>

        {/* Informative Card */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.card}>
          <Text style={styles.cardTitle}>میدان رقابت یا مسیر شخصی؟</Text>
          <Text style={styles.cardDesc}>
            آیا می‌خواهی با ساخت یا پیوستن به یک کلاس، تکالیف مشترک داشته باشید و در لیدربورد با دوستانت رقابت کنی؟
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {/* Create Class */}
            <Pressable
              onPress={() => {
                setError(null);
                setShowCreateModal(true);
              }}
              style={styles.primaryBtn}
            >
              <LinearGradient
                colors={[colors.emerald, colors.success]}
                style={styles.gradientBtn}
              >
                <Text style={styles.primaryBtnText}>ساخت کلاس جدید</Text>
                <Ionicons name="add-circle-outline" size={20} color={colors.ink} />
              </LinearGradient>
            </Pressable>

            {/* Join Class */}
            <Pressable
              onPress={() => {
                setError(null);
                setShowJoinModal(true);
              }}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>پیوستن با کد دعوت</Text>
              <Ionicons name="key-outline" size={18} color={colors.text} />
            </Pressable>

            {/* Solo Mode */}
            <Pressable onPress={handleSoloMode} style={styles.soloBtn}>
              <Text style={styles.soloBtnText}>فقط خودم (حالت فردی)</Text>
              <Ionicons name="person-outline" size={16} color={colors.muted} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Create Class Modal */}
        <Modal
          visible={showCreateModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShowCreateModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
                <Text style={styles.modalTitle}>ساخت کلاس جدید</Text>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>نام کلاس</Text>
              <TextInput
                value={className}
                onChangeText={setClassName}
                placeholder="مثلاً: یازدهم شبکه ۲"
                placeholderTextColor={colors.faint}
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>توضیحات (اختیاری)</Text>
              <TextInput
                value={classDesc}
                onChangeText={setClassDesc}
                placeholder="رشته، مدرسه یا سال تحصیلی..."
                placeholderTextColor={colors.faint}
                style={[styles.modalInput, { height: 70, textAlignVertical: "top" }]}
                multiline
              />

              <Pressable
                onPress={handleCreateSubmit}
                disabled={loading}
                style={styles.modalSubmitBtn}
              >
                <LinearGradient
                  colors={[colors.emerald, colors.success]}
                  style={styles.gradientBtn}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <Text style={styles.primaryBtnText}>ایجاد و دریافت کد دعوت</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Join Class Modal */}
        <Modal
          visible={showJoinModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowJoinModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShowJoinModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
                <Text style={styles.modalTitle}>پیوستن به کلاس</Text>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>کد دعوت کلاس</Text>
              <TextInput
                value={joinCode}
                onChangeText={(v) => setJoinCode(v.toUpperCase())}
                placeholder="مثال: NET101"
                placeholderTextColor={colors.faint}
                autoCapitalize="characters"
                style={[styles.modalInput, { letterSpacing: 3, textAlign: "center", fontSize: 18 }]}
              />

              <Pressable
                onPress={handleJoinSubmit}
                disabled={loading}
                style={styles.modalSubmitBtn}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDeep]}
                  style={styles.gradientBtn}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                      پیوستن به همکلاسی‌ها
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    paddingTop: 14,
  },
  tagBadge: {
    backgroundColor: colors.white06,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  tagText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 11,
    color: colors.muted,
  },
  headerTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 16,
    color: colors.text,
  },
  canvasContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    maxHeight: 290,
    position: "relative",
  },
  dragHintBox: {
    position: "absolute",
    bottom: -12,
    alignItems: "center",
  },
  dragHint: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 11,
    color: colors.faint,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.panelPhone,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
    marginBottom: 20,
  },
  cardTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 20,
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  cardDesc: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 13,
    color: colors.bodyCopy,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  actionsContainer: {
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  gradientBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  primaryBtnText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 15,
    color: colors.ink,
  },
  secondaryBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.white06,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 13,
  },
  secondaryBtnText: {
    fontFamily: "Vazirmatn_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  soloBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  soloBtnText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 13,
    color: colors.muted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 24,
    padding: 22,
  },
  modalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 17,
    color: colors.text,
  },
  inputLabel: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: colors.inkRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
    marginBottom: 14,
  },
  modalSubmitBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLine,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.danger,
    textAlign: "right",
  },
});
