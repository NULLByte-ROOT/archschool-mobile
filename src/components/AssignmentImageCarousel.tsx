import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { resolveMediaUrl } from "@/api/client";
import type { Attachment } from "@/api/types";
import { AppText } from "@/components/ui";
import { colors, radius } from "@/theme/tokens";

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|heic|heif|avif|bmp)(\?|$)/i;

export function isImageAttachment(att: Attachment): boolean {
  return IMAGE_EXT_RE.test(att.file_url) || IMAGE_EXT_RE.test(att.file_name);
}

export interface AssignmentImageCarouselProps {
  attachments?: Attachment[];
  height?: number;
  onImagePress?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

function AssignmentImageCarouselComponent({
  attachments = [],
  height = 180,
  onImagePress,
  style,
}: AssignmentImageCarouselProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const images = React.useMemo(
    () => attachments.filter(isImageAttachment),
    [attachments]
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  }, [containerWidth]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (containerWidth <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / containerWidth);
      if (idx !== currentIndex && idx >= 0 && idx < images.length) {
        setCurrentIndex(idx);
        void Haptics.selectionAsync().catch(() => undefined);
      }
    },
    [containerWidth, currentIndex, images.length]
  );

  if (images.length === 0) return null;

  // Single Image
  if (images.length === 1) {
    const single = images[0];
    const resolvedUrl = resolveMediaUrl(single.file_url);

    return (
      <View
        onLayout={onLayout}
        style={[styles.container, { height }, style]}
      >
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            void Haptics.selectionAsync().catch(() => undefined);
            onImagePress?.(0);
          }}
          style={styles.fill}
          accessibilityRole="imagebutton"
          accessibilityLabel="نمایش تصویر پیوست تکلیف"
        >
          <Image
            source={{ uri: resolvedUrl }}
            style={styles.image}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
          <View style={styles.zoomPill}>
            <Ionicons name="expand-outline" size={13} color={colors.white} />
          </View>
        </Pressable>
      </View>
    );
  }

  // Multiple Images (2+)
  return (
    <View
      onLayout={onLayout}
      style={[styles.container, { height }, style]}
    >
      {containerWidth > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ width: containerWidth * images.length }}
        >
          {images.map((att, idx) => {
            const resolvedUrl = resolveMediaUrl(att.file_url);
            return (
              <Pressable
                key={att.id || idx}
                onPress={(e) => {
                  e.stopPropagation();
                  void Haptics.selectionAsync().catch(() => undefined);
                  onImagePress?.(idx);
                }}
                style={{ width: containerWidth, height }}
                accessibilityRole="imagebutton"
                accessibilityLabel={`نمایش تصویر ${idx + 1} از ${images.length}`}
              >
                <Image
                  source={{ uri: resolvedUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Counter Pill (Top-Left) */}
      <View style={styles.counterPill} pointerEvents="none">
        <Ionicons name="images-outline" size={11} color={colors.white} style={{ marginRight: 4 }} />
        <AppText ltr color={colors.white} style={styles.counterText}>
          {`${currentIndex + 1} / ${images.length}`}
        </AppText>
      </View>

      {/* Pagination Dots (Bottom Center) */}
      <View style={styles.dotsContainer} pointerEvents="none">
        {images.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export const AssignmentImageCarousel = memo(AssignmentImageCarouselComponent);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.40)",
    marginBottom: 10,
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  zoomPill: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.60)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  counterPill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  counterText: {
    fontSize: 10,
    fontFamily: "Vazirmatn_700Bold",
    lineHeight: 14,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.60)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  dot: {
    height: 4.5,
    borderRadius: 2.5,
  },
  dotActive: {
    width: 14,
    backgroundColor: colors.amber,
  },
  dotInactive: {
    width: 4.5,
    backgroundColor: "rgba(255,255,255,0.40)",
  },
});
