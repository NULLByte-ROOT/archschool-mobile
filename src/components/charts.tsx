/**
 * Tiny native chart kit for the assignment dashboards.
 *
 * The web renders these with Recharts (an area chart and a donut). Recharts is
 * a web-only dependency, so the same geometry is drawn directly with
 * `react-native-svg`: identical colours, identical labels, no extra package.
 */

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from "react-native-svg";

import { AppText } from "@/components/ui";
import { fmtNum } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

export interface ChartPoint {
  label: string;
  value: number;
}

/** Smooth monotone-ish curve through the points (Catmull-Rom → bezier). */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * White area chart, mirroring the web `DeadlineTrendChart`.
 *
 * Tapping a column shows a small popover with the exact value + label, the
 * same information the web reveals on hover. `dotColors` lets callers paint
 * individual points (the profile uses green for active days, red for empty).
 */
export function AreaChart({
  data,
  height = 158,
  color = "#ffffff",
  unit,
  dotColors,
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
  /** Appended to the value inside the popover (e.g. «تکلیف»). */
  unit?: string;
  /** One colour per point — omit for the plain white dots. */
  dotColors?: string[];
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const padX = 10;
  const padTop = 14;
  const padBottom = 8;
  const max = Math.max(1, ...data.map((point) => point.value));
  const innerW = Math.max(0, width - padX * 2);
  const innerH = Math.max(1, height - padTop - padBottom);

  const points = data.map((point, index) => ({
    x: padX + (data.length === 1 ? innerW / 2 : (index / (data.length - 1)) * innerW),
    y: padTop + (1 - point.value / max) * innerH,
  }));

  const line = smoothPath(points);
  const area = line
    ? `${line} L ${points[points.length - 1].x} ${height - padBottom} L ${points[0].x} ${
        height - padBottom
      } Z`
    : "";

  const activePoint = active !== null ? points[active] : null;
  const activeValue = active !== null ? data[active]?.value ?? 0 : 0;
  const popoverWidth = 78;
  const popoverLeft = activePoint
    ? Math.max(0, Math.min(width - popoverWidth, activePoint.x - popoverWidth / 2))
    : 0;
  const popoverTop = activePoint ? Math.max(0, activePoint.y - 46) : 0;

  return (
    <View
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
          <Svg width={width} height={height}>
            <Defs>
              <SvgGradient id="deadlineFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.35} />
                <Stop offset="0.7" stopColor={color} stopOpacity={0.08} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </SvgGradient>
            </Defs>

            {[0.25, 0.5, 0.75].map((fraction) => (
              <Path
                key={fraction}
                d={`M ${padX} ${padTop + innerH * fraction} L ${width - padX} ${
                  padTop + innerH * fraction
                }`}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            ))}

            {area ? <Path d={area} fill="url(#deadlineFill)" /> : null}
            {line ? (
              <Path
                d={line}
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : null}

            {points.map((point, index) => {
              const value = data[index]?.value ?? 0;
              const dot = dotColors?.[index];
              const selected = active === index;
              return (
                <Circle
                  key={`${data[index]?.label ?? index}-dot`}
                  cx={point.x}
                  cy={point.y}
                  r={selected ? 5 : dot ? (value > 0 ? 3.2 : 2.6) : value > 0 ? 3 : 0}
                  fill={dot ?? color}
                  stroke={selected ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)"}
                  strokeWidth={selected ? 2 : 3}
                />
              );
            })}
          </Svg>

          {/* Tap zones: one per data point, so a bar/point is always reachable. */}
          <View style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, flexDirection: "row" }}>
              {data.map((point, index) => (
                <Pressable
                  key={`${point.label}-${index}-tap`}
                  style={{ flex: 1 }}
                  onPress={() =>
                    setActive((current) => (current === index ? null : index))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${point.label}: ${fmtNum(point.value)}`}
                />
              ))}
            </View>
          </View>

          {activePoint ? (
            <View
              pointerEvents="none"
              style={[
                styles.popover,
                { left: popoverLeft, top: popoverTop, width: popoverWidth },
              ]}
            >
              <AppText
                ltr
                style={{ fontFamily: fonts.black, fontSize: 13, lineHeight: 18 }}
              >
                {fmtNum(activeValue)}
                {unit ? ` ${unit}` : ""}
              </AppText>
              <AppText
                align="center"
                color={colors.faint}
                style={{ fontSize: 9, lineHeight: 13 }}
              >
                {data[active!]?.label ?? ""}
              </AppText>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const polar = (cx: number, cy: number, r: number, angle: number) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

/** Stroke-only arc between two angles (0° = 12 o'clock, clockwise). */
function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const from = polar(cx, cy, r, start);
  const to = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 ${large} 1 ${to.x} ${to.y}`;
}

/**
 * Donut mirroring the web `SubjectBreakdownChart`.
 *
 * Each slice is a real arc path with a 2px background-coloured gap (no round
 * caps bleeding into the next slice), and every arc is tappable so the caller
 * can open a detail sheet.
 */
export function Donut({
  slices,
  size = 132,
  thickness = 20,
  centerValue,
  centerLabel,
  onSlicePress,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel: string;
  onSlicePress?: (index: number, slice: DonutSlice) => void;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radiusValue = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const gapDeg = slices.length > 1 ? (2 / circumference) * 360 : 0;
  const center = size / 2;
  let cursor = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radiusValue}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={thickness}
        />
        {total > 0
          ? slices.map((slice, index) => {
              const span = (slice.value / total) * 360;
              const start = cursor + gapDeg / 2;
              const end = cursor + span - gapDeg / 2;
              cursor += span;
              if (end <= start) return null;
              return (
                <Path
                  key={slice.label}
                  d={arcPath(center, center, radiusValue, start, end)}
                  stroke={slice.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  fill="none"
                  onPress={
                    onSlicePress ? () => onSlicePress(index, slice) : undefined
                  }
                />
              );
            })
          : null}
      </Svg>
    </View>
  );
}

/** Horizontal segmented bar (mobile `AssignmentTypesChart`). */
export function SegmentedBar({
  slices,
  height = 12,
}: {
  slices: DonutSlice[];
  height?: number;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <View style={[styles.bar, { height }]}>
      {total > 0
        ? slices.map((slice) =>
            slice.value > 0 ? (
              <View
                key={slice.label}
                style={{
                  width: `${(slice.value / total) * 100}%`,
                  backgroundColor: slice.color,
                }}
              />
            ) : null
          )
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row-reverse",
    width: "100%",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  popover: {
    position: "absolute",
    alignItems: "center",
    gap: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(9,9,11,0.94)",
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
});
