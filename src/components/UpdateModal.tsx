import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import { AppText } from "@/components/ui";
import { openApkDownload, restartApp, type UpdateCheckResponse } from "@/lib/updater";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

interface UpdateModalProps {
  state: UpdateCheckResponse | null;
  onDismiss?: () => void;
}

export function UpdateModal({ state, onDismiss }: UpdateModalProps) {
  if (!state || state.updateType === "none") {
    return null;
  }

  const isApk = state.updateType === "apk";
  const isOta = state.updateType === "ota" && state.otaReady;

  if (!isApk && !isOta) {
    return null;
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={true}
      onRequestClose={() => {
        if (!state.mandatory && !isApk && onDismiss) {
          onDismiss();
        }
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient
            colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.iconCircle}>
            <Ionicons
              name={isApk ? "cloud-download" : "sparkles"}
              size={32}
              color={isApk ? colors.flame : colors.emerald}
            />
          </View>

          <AppText variant="title" align="center" style={styles.title}>
            {isApk ? "ارتقای نسخه اصلی برنامه" : "به‌روزرسانی آماده است"}
          </AppText>

          <View style={styles.badgeRow}>
            <View style={styles.versionBadge}>
              <AppText variant="caption" color={colors.textSoft}>
                {isApk ? `نسخه الزامی: ${state.minApkVersion || state.version}` : `نسخه: ${state.version}`}
              </AppText>
            </View>
          </View>

          <AppText variant="body" color={colors.textSoft} align="center" style={styles.description}>
            {isApk
              ? "برای دسترسی به آخرین امکانات و حفظ سازگاری با سرور، نصب نسخه جدید فایل نصبی (APK) الزامی است."
              : "تغییرات جدید ظاهر و عملکردهای اپلیکیشن دریافت شدند. برای اعمال نهایی کافیست برنامه را مجدداً راه‌اندازی کنید."}
          </AppText>

          {state.releaseNotes ? (
            <View style={styles.notesBox}>
              <AppText variant="label" color={colors.muted} align="right" style={styles.notesLabel}>
                تغییرات این نسخه:
              </AppText>
              <ScrollView style={styles.notesScroll} nestedScrollEnabled>
                <AppText variant="caption" color={colors.text} align="right">
                  {state.releaseNotes}
                </AppText>
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            {isApk ? (
              <Button
                label="دانلود و نصب مستقیم APK"
                icon="download-outline"
                variant="primary"
                onPress={() => void openApkDownload(state.apkUrl)}
              />
            ) : (
              <Button
                label="راه‌اندازی مجدد ArchSchool"
                icon="refresh-outline"
                variant="primary"
                onPress={() => void restartApp()}
              />
            )}

            {!state.mandatory && !isApk && onDismiss ? (
              <View style={styles.dismissBtn}>
                <Button
                  label="بعداً یادآوری کن"
                  variant="ghost"
                  size="sm"
                  onPress={onDismiss}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: spacing.xl,
    alignItems: "center",
    overflow: "hidden",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.bold,
    marginBottom: spacing.xs,
  },
  badgeRow: {
    marginBottom: spacing.md,
  },
  versionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.panelSolid,
    borderWidth: 1,
    borderColor: colors.line,
  },
  description: {
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  notesBox: {
    width: "100%",
    maxHeight: 120,
    backgroundColor: colors.panelSolid,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  notesLabel: {
    marginBottom: 4,
  },
  notesScroll: {
    maxHeight: 90,
  },
  actionRow: {
    width: "100%",
    gap: spacing.sm,
  },
  dismissBtn: {
    marginTop: spacing.xs,
  },
});
