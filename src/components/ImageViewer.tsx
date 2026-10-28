import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui";
import { colors, fonts, radius } from "@/theme/tokens";

/**
 * Telegram-style full-screen image viewer for the whole app.
 *
 * - Pinch to zoom (1×–5×), drag to pan while zoomed, double-tap to toggle,
 *   swipe left/right to walk through the gallery when it is not zoomed.
 * - Download writes the file into the app's document directory with the
 *   already-installed `expo-file-system` (no new native module, OTA-safe).
 * - The caller passes the images of one context (a room, an assignment) and
 *   the index that was tapped, exactly like the web `ImageViewer`.
 */

export interface ViewerImage {
  src: string;
  alt?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SWIPE_THRESHOLD = 70;

export function ImageViewer({
  visible,
  images,
  index = 0,
  onClose,
}: {
  visible: boolean;
  images: ViewerImage[];
  index?: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(index);
  const [downloading, setDownloading] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const total = images.length;
  const safeIndex = total > 0 ? Math.min(Math.max(current, 0), total - 1) : 0;
  const image = total > 0 ? images[safeIndex] : null;

  // Opening the viewer (or tapping another thumbnail) starts at the tapped item.
  useEffect(() => {
    if (!visible) return;
    setCurrent(Math.min(Math.max(index, 0), Math.max(0, images.length - 1)));
  }, [visible, index, images.length]);

  // Every image switch returns the transform to its neutral state.
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  }, [safeIndex, visible, scale, savedScale, translateX, translateY, savedX, savedY]);

  const step = (delta: number) => {
    if (total < 2) return;
    setCurrent((previous) => (previous + delta + total) % total);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_SCALE + 0.01) {
        scale.value = withTiming(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > MIN_SCALE) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd((event) => {
      if (scale.value > MIN_SCALE) {
        const maxX = (width * (scale.value - 1)) / 2;
        const maxY = (height * (scale.value - 1)) / 2;
        const nextX = Math.min(maxX, Math.max(-maxX, translateX.value));
        const nextY = Math.min(maxY, Math.max(-maxY, translateY.value));
        translateX.value = withTiming(nextX);
        translateY.value = withTiming(nextY);
        savedX.value = nextX;
        savedY.value = nextY;
        return;
      }
      if (
        total > 1 &&
        Math.abs(event.translationX) > SWIPE_THRESHOLD &&
        Math.abs(event.translationX) > Math.abs(event.translationY)
      ) {
        runOnJS(step)(event.translationX < 0 ? 1 : -1);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > MIN_SCALE + 0.01) {
        scale.value = withTiming(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const singleTap = Gesture.Tap().onEnd(() => {
    runOnJS(onClose)();
  });

  const gesture = Gesture.Simultaneous(
    pinch,
    pan,
    Gesture.Exclusive(doubleTap, singleTap)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const download = async () => {
    if (!image || downloading) return;
    setDownloading(true);
    try {
      const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!root) throw new Error("no writable directory");
      const directory = `${root}archschool-images/`;
      await FileSystem.makeDirectoryAsync(directory, {
        intermediates: true,
      }).catch(() => undefined);
      const extension = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(image.src)?.[1];
      const target = `${directory}archschool-${Date.now()}.${
        extension?.toLowerCase() ?? "jpg"
      }`;
      const result = await FileSystem.downloadAsync(image.src, target);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => undefined);
      Alert.alert(
        "ذخیره شد",
        `تصویر در حافظهٔ برنامه ذخیره شد:\n${result.uri}`
      );
    } catch {
      Alert.alert("دانلود نشد", "ذخیرهٔ تصویر ممکن نشد.");
    } finally {
      setDownloading(false);
    }
  };

  if (!visible || !image) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.stage, animatedStyle]}>
            <Image
              source={{ uri: image.src }}
              style={styles.image}
              contentFit="contain"
              transition={120}
              cachePolicy="memory-disk"
            />
          </Animated.View>
        </GestureDetector>

        <Pressable
          onPress={onClose}
          style={[styles.headerButton, styles.closeButton, { top: insets.top + 12 }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="بستن تصویر"
        >
          <Ionicons name="close" size={22} color={colors.white} />
        </Pressable>

        <Pressable
          onPress={() => void download()}
          disabled={downloading}
          style={[styles.headerButton, styles.downloadButton, { top: insets.top + 12 }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="دانلود تصویر"
        >
          {downloading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="download-outline" size={20} color={colors.white} />
          )}
        </Pressable>

        {total > 1 ? (
          <>
            <View style={[styles.counter, { top: insets.top + 18 }]} pointerEvents="none">
              <AppText
                ltr
                color={colors.white}
                style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 16 }}
              >
                {`${safeIndex + 1} / ${total}`}
              </AppText>
            </View>

            <Pressable
              onPress={() => step(1)}
              style={[styles.navButton, styles.navNext]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="تصویر بعدی"
            >
              <Ionicons name="chevron-back" size={24} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={() => step(-1)}
              style={[styles.navButton, styles.navPrev]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="تصویر قبلی"
            >
              <Ionicons name="chevron-forward" size={24} color={colors.white} />
            </Pressable>
          </>
        ) : null}

        {image.alt ? (
          <View
            style={[styles.caption, { bottom: insets.bottom + 20 }]}
            pointerEvents="none"
          >
            <AppText
              numberOfLines={1}
              color="rgba(255,255,255,0.82)"
              style={{ fontSize: 11, lineHeight: 16 }}
            >
              {image.alt}
            </AppText>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
  },
  stage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  headerButton: {
    position: "absolute",
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  closeButton: { left: 16 },
  downloadButton: { left: 64 },
  counter: {
    position: "absolute",
    zIndex: 4,
    alignSelf: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  navButton: {
    position: "absolute",
    zIndex: 4,
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  navNext: { left: 10 },
  navPrev: { right: 10 },
  caption: {
    position: "absolute",
    zIndex: 4,
    alignSelf: "center",
    maxWidth: "82%",
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
