import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThreeDCore } from "@/components/ThreeDCore";
import { colors } from "@/theme/tokens";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    title: "دستیار هوشمند درس‌ها و تکالیف",
    subtitle: "سازماندهی فوق‌پیشرفته",
    description:
      "تکالیف، پروژه‌ها و جزوات کلاسی را در یک فضای هوشمند، شیک و همیشه در دسترس مدیریت کن.",
    badge: "هسته مرکزی",
    accent: "#60A5FA",
  },
  {
    title: "دیدبان زنده زنگ‌ها و زمان",
    subtitle: "تایمرهای دقیق و زنگ تفریح",
    description:
      "شمارش معکوس بلادرنگ برای پایان زنگ‌ها، مدیریت زنگ‌های تفریح و جدول برنامه هفتگی اختصاصی.",
    badge: "رادار زمان",
    accent: colors.warning,
  },
  {
    title: "رقابت تیمی و لیگ همکلاسی‌ها",
    subtitle: "استریک روزانه و لیدربورد",
    description:
      "با دوستانت در کلاس رقابت کن، استریک ثبت کن و نامت را در صدر جدول برترین‌های مدرسه ثبت کن.",
    badge: "لیگ کلاس",
    accent: colors.emerald,
  },
];

export default function OnboardingOverview() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push("/onboarding/auth");
    }
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/onboarding/auth");
  };

  const slide = SLIDES[currentSlide];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Top Bar with Skip */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.topBar}>
          <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipBtn}>
            <Text style={styles.skipText}>رد شدن</Text>
            <Ionicons name="chevron-back" size={16} color={colors.muted} />
          </Pressable>

          <View style={styles.brandRow}>
            <View style={[styles.statusDot, { backgroundColor: slide.accent }]} />
            <Text style={styles.brandTitle}>ARCHSCHOOL 2.0</Text>
          </View>
        </Animated.View>

        {/* 3D Masterpiece Model View */}
        <View style={styles.canvasContainer}>
          <ThreeDCore stage={currentSlide} interactive={true} />
          <Text style={styles.dragHint}>
            <Ionicons name="finger-print-outline" size={12} color={colors.faint} /> برای چرخش سه‌بعدی لمس و بکشید
          </Text>
        </View>

        {/* Info Slide Card */}
        <Animated.View
          key={currentSlide}
          entering={FadeInUp.duration(400)}
          style={styles.card}
        >
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { borderColor: slide.accent }]}>
              <Text style={[styles.badgeText, { color: slide.accent }]}>
                {slide.badge}
              </Text>
            </View>
            <Text style={styles.subtitleText}>{slide.subtitle}</Text>
          </View>

          <Text style={styles.titleText}>{slide.title}</Text>
          <Text style={styles.descriptionText}>{slide.description}</Text>
        </Animated.View>

        {/* Pagination & Continue Button */}
        <View style={styles.bottomSection}>
          <View style={styles.paginationRow}>
            {SLIDES.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === currentSlide
                    ? [styles.activeDot, { backgroundColor: slide.accent, width: 28 }]
                    : null,
                ]}
              />
            ))}
          </View>

          <Pressable onPress={handleNext} style={styles.continueBtn}>
            <LinearGradient
              colors={[colors.accent, colors.accentDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnGradient}
            >
              <Text style={styles.continueText}>
                {currentSlide === SLIDES.length - 1 ? "ورود و ثبت‌نام" : "ادامه"}
              </Text>
              <Ionicons
                name={
                  currentSlide === SLIDES.length - 1
                    ? "arrow-back"
                    : "chevron-back"
                }
                size={18}
                color={colors.onAccent}
              />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
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
  topBar: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  skipBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.white05,
    borderWidth: 1,
    borderColor: colors.line,
  },
  skipText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 13,
    color: colors.muted,
  },
  brandRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 14,
    letterSpacing: 1.5,
    color: colors.text,
  },
  canvasContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    maxHeight: 330,
  },
  dragHint: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 11,
    color: colors.faint,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.panelPhone,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.white03,
  },
  badgeText: {
    fontFamily: "Vazirmatn_600SemiBold",
    fontSize: 11,
  },
  subtitleText: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  titleText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 20,
    color: colors.text,
    textAlign: "right",
    marginBottom: 8,
    lineHeight: 30,
  },
  descriptionText: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 14,
    color: colors.bodyCopy,
    textAlign: "right",
    lineHeight: 22,
  },
  bottomSection: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 20,
    gap: 16,
  },
  paginationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white15,
  },
  activeDot: {
    borderRadius: 4,
  },
  continueBtn: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  btnGradient: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  continueText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 16,
    color: colors.onAccent,
  },
});
