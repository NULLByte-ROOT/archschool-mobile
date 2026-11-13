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
    badge: "// ۰۱ · هسته هوشمند تکالیف",
    subtitle: "سازماندهی مدرن تحصیلی",
    title: "مدیریت یکپارچه درس‌ها و سررسیدها",
    description:
      "تمام تکالیف، جزوه‌ها، پیوست‌ها و موعدهای درسی را در یک فضای هوشمند، شیک و همیشه در دسترس پیگیری کن.",
    accent: "#38BDF8",
    gradient: ["#0284C7", "#38BDF8"] as const,
  },
  {
    type: 1 as const,
    badge: "// ۰۲ · رادار زمان و زنگ‌ها",
    subtitle: "تایمرهای دقیق و زنگ تفریح",
    title: "دیدبان زنده زنگ‌ها و تایم‌لاین",
    description:
      "شمارش معکوس بلادرنگ برای پایان زنگ‌های کلاس و تفریح؛ جدول هفتگی مدرسه بدون هیچ سردرگمی و استرس.",
    accent: "#FBBF24",
    gradient: ["#D97706", "#FBBF24"] as const,
  },
  {
    type: 2 as const,
    badge: "// ۰۳ · لیگ کلاسی و رقابت",
    subtitle: "استریک روزانه و لیدربورد",
    title: "رقابت تیمی، استریک و لیدربورد",
    description:
      "با دوستانت در کلاس رقابت کن، استریک انجام روزانه تکالیف بساز و جایگاهت را در صدر جدول برترین‌های کلاس ثبت کن.",
    accent: "#34D399",
    gradient: ["#059669", "#34D399"] as const,
  },
];

function ScrollHint({ accent }: { accent: string }) {
  const bounce = useSharedValue(0);

  React.useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 750 }),
        withTiming(0, { duration: 750 })
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
        برای دیدن بخش بعد به پایین بکشید
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

  const topInset = Math.max(insets.top, 24);
  const bottomInset = Math.max(insets.bottom, 16);

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
      {/* Floating Top Navigation (Guaranteed clearance from status bar/notch) */}
      <View style={[styles.topHeader, { top: topInset + 12 }]}>
        <Pressable onPress={handleSkip} hitSlop={14} style={styles.skipBtn}>
          <Text style={styles.skipText}>رد شدن</Text>
          <Ionicons name="chevron-back" size={14} color={colors.muted} />
        </Pressable>

        {/* Step Indicator Dots */}
        <View style={styles.indicatorContainer}>
          {SLIDES.map((s, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === currentPage
                  ? [styles.activeDot, { backgroundColor: s.accent }]
                  : null,
              ]}
            />
          ))}
        </View>

        <View style={styles.brandBadge}>
          <Text style={styles.brandTitle}>ARCHSCHOOL</Text>
        </View>
      </View>

      {/* Full-Screen Vertical Paging ScrollView */}
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
              {/* Fullscreen Interactive 3D World (Occupies 100% of the screen) */}
              <ThreeDFullScene type={slide.type} />

              {/* Touch Rotation Hint */}
              <View style={[styles.touchHintWrapper, { top: height * 0.54 }]}>
                <View style={styles.touchHintPill}>
                  <Ionicons name="finger-print-outline" size={13} color={slide.accent} />
                  <Text style={[styles.touchHintText, { color: colors.muted }]}>
                    برای چرخش سه‌بعدی لمس کنید و بچرخانید
                  </Text>
                </View>
              </View>

              {/* Informative Floating Glass Card at Bottom */}
              <View
                style={[
                  styles.cardWrapper,
                  { bottom: bottomInset + 18 },
                ]}
              >
                <View
                  style={[
                    styles.glassCard,
                    { borderColor: `${slide.accent}40` },
                  ]}
                >
                  {/* Badge & Subtitle Row */}
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.badge,
                        { borderColor: slide.accent, backgroundColor: `${slide.accent}14` },
                      ]}
                    >
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
                        colors={[slide.accent, colors.accentDeep]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.continueGradient}
                      >
                        <Text style={styles.continueBtnText}>شروع و انتخاب روش ورود</Text>
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
    backgroundColor: "#08080C",
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
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "rgba(16,16,24,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  skipText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  indicatorContainer: {
    flexDirection: "row-reverse",
    gap: 6,
    alignItems: "center",
    backgroundColor: "rgba(16,16,24,0.85)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  activeDot: {
    width: 18,
    borderRadius: 3,
  },
  brandBadge: {
    backgroundColor: "rgba(16,16,24,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  brandTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 12,
    letterSpacing: 1.6,
    color: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  page: {
    position: "relative",
    backgroundColor: "#08080C",
    overflow: "hidden",
  },
  touchHintWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  touchHintPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(12,12,18,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  touchHintText: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 11,
  },
  cardWrapper: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 20,
  },
  glassCard: {
    backgroundColor: "rgba(14, 14, 22, 0.94)",
    borderWidth: 1.2,
    borderRadius: 26,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.65,
    shadowRadius: 24,
    elevation: 10,
  },
  badgeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
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
    fontSize: 19,
    color: "#FFFFFF",
    textAlign: "right",
    marginBottom: 8,
    lineHeight: 28,
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
