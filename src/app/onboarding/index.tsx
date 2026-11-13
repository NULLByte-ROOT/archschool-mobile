import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThreeDFullScene } from "@/components/ThreeDFullScene";
import { colors } from "@/theme/tokens";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    type: 0 as const,
    badge: "// ۰۱ · هسته هوشمند",
    subtitle: "سازماندهی فوق‌پیشرفته و هوشمند",
    title: "مدیریت یکپارچه درس‌ها و تکالیف",
    description:
      "تمام تکالیف، جزوات، پیوست‌ها و سررسیدهای درسی را در یک فضای هوشمند، شیک و همیشه در دسترس مدیریت کن.",
    accent: "#38BDF8",
    gradient: ["#0284C7", "#38BDF8"] as const,
  },
  {
    type: 1 as const,
    badge: "// ۰۲ · رادار زمان",
    subtitle: "تایمرهای دقیق و زنگ تفریح",
    title: "دیدبان زنده زنگ‌ها و تایم‌لاین",
    description:
      "شمارش معکوس بلادرنگ برای پایان زنگ‌ها، مدیریت زنگ‌های تفریح و جدول برنامه هفتگی بدون هیچ سردرگمی.",
    accent: "#FBBF24",
    gradient: ["#D97706", "#FBBF24"] as const,
  },
  {
    type: 2 as const,
    badge: "// ۰۳ · لیگ کلاسی",
    subtitle: "استریک روزانه و لیدربورد",
    title: "رقابت تیمی، استریک و لیدربورد",
    description:
      "با دوستانت در کلاس رقابت کن، استریک روزانه ثبت کن و جایگاهت را در صدر جدول برترین‌های مدرسه تثبیت کن.",
    accent: "#34D399",
    gradient: ["#059669", "#34D399"] as const,
  },
];

function ScrollHint({ accent }: { accent: string }) {
  const bounce = useSharedValue(0);

  React.useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 800 }),
        withTiming(0, { duration: 800 })
      ),
      -1,
      true
    );
  }, [bounce]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  return (
    <Animated.View style={[styles.scrollHintContainer, animStyle]}>
      <Text style={[styles.scrollHintText, { color: accent }]}>
        برای ادامه به پایین بکشید
      </Text>
      <Ionicons name="chevron-down" size={18} color={accent} />
    </Animated.View>
  );
}

export default function OnboardingOverview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.y / height);
    if (page !== currentPage && page >= 0 && page < SLIDES.length) {
      setCurrentPage(page);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/onboarding/auth");
  };

  const handleContinue = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/auth");
  };

  return (
    <View style={styles.root}>
      {/* Floating Top Header (Fixed above scroll) */}
      <View style={[styles.topHeader, { top: insets.top + 10 }]}>
        <Pressable onPress={handleSkip} hitSlop={14} style={styles.skipBtn}>
          <Text style={styles.skipText}>رد شدن</Text>
          <Ionicons name="chevron-back" size={14} color={colors.muted} />
        </Pressable>

        {/* Vertical Page Indicator Pills */}
        <View style={styles.indicatorPills}>
          {SLIDES.map((s, idx) => (
            <View
              key={idx}
              style={[
                styles.pill,
                idx === currentPage
                  ? [styles.activePill, { backgroundColor: s.accent, height: 22 }]
                  : null,
              ]}
            />
          ))}
        </View>

        <View style={styles.brandBadge}>
          <Text style={styles.brandTitle}>ARCHSCHOOL</Text>
        </View>
      </View>

      {/* Full-Screen Vertical Pager */}
      <ScrollView
        ref={scrollRef}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={height}
        snapToAlignment="start"
        onMomentumScrollEnd={handleScroll}
        style={styles.scrollView}
      >
        {SLIDES.map((slide, idx) => {
          const isLast = idx === SLIDES.length - 1;
          return (
            <View key={idx} style={[styles.page, { height, width }]}>
              {/* Fullscreen 3D Interactive Model Scene */}
              <View style={[styles.sceneWrapper, { marginTop: insets.top + 30 }]}>
                <ThreeDFullScene type={slide.type} />
                <Text style={styles.touchHint}>
                  <Ionicons name="finger-print-outline" size={12} color={colors.faint} /> برای چرخش لمس کنید و بچرخانید
                </Text>
              </View>

              {/* Informative Floating Card */}
              <View style={[styles.cardWrapper, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.glassCard}>
                  {/* Badge Row */}
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

                  {/* On last slide: Action Continue Button */}
                  {isLast ? (
                    <Pressable onPress={handleContinue} style={styles.continueBtn}>
                      <LinearGradient
                        colors={[colors.accent, colors.accentDeep]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.continueGradient}
                      >
                        <Text style={styles.continueBtnText}>شروع تجربه و ورود</Text>
                        <Ionicons name="arrow-back" size={18} color={colors.onAccent} />
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    /* On earlier slides: Animated Scroll Down Prompt */
                    <ScrollHint accent={slide.accent} />
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  topHeader: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 50,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(20,20,28,0.75)",
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  skipText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  indicatorPills: {
    flexDirection: "column",
    gap: 5,
    alignItems: "center",
    backgroundColor: "rgba(20,20,28,0.65)",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pill: {
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.white15,
  },
  activePill: {
    width: 4,
    borderRadius: 2,
  },
  brandBadge: {
    backgroundColor: "rgba(20,20,28,0.75)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  brandTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  page: {
    justifyContent: "space-between",
    backgroundColor: colors.ink,
  },
  sceneWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  touchHint: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 11,
    color: colors.faint,
    marginTop: 4,
  },
  cardWrapper: {
    paddingHorizontal: 20,
  },
  glassCard: {
    backgroundColor: "rgba(12,12,18,0.92)",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 26,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
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
    fontFamily: "Vazirmatn_700Bold",
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
    fontSize: 13,
    color: colors.bodyCopy,
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 16,
  },
  scrollHintContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    gap: 2,
  },
  scrollHintText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
  },
  continueBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 4,
  },
  continueGradient: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  continueBtnText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 15,
    color: colors.onAccent,
  },
});
