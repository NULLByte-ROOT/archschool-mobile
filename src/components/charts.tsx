/**
 * Tiny native chart kit for the assignment dashboards.
 *
 * The web renders these with Recharts (an area chart and a donut). Recharts is
 * a web-only dependency, so the same geometry is drawn directly with
 * `react-native-svg`: identical colours, identical labels, no extra package.
 */

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from "react-native-svg";

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

/** White area chart, mirroring the web `DeadlineTrendChart`. */
export function AreaChart({
  data,
  height = 158,
  color = "#ffffff",
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
}) {
  const [width, setWidth] = useState(0);
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

  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
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

          {points.map((point, index) => (
            <Circle
              key={`${data[index]?.label ?? index}-dot`}
              cx={point.x}
              cy={point.y}
              r={data[index].value > 0 ? 3 : 0}
              fill={color}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={3}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Donut mirroring the web `SubjectBreakdownChart` (paddingAngle 3, cornerRadius 6). */
export function Donut({
  slices,
  size = 132,
  thickness = 20,
  centerValue,
  centerLabel,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 2.5 : 0;
  let offset = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={thickness}
        />
        {total > 0
          ? slices.map((slice) => {
              const length = (slice.value / total) * circumference;
              const dash = Math.max(0, length - gap);
              const element = (
                <Circle
                  key={slice.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  origin={`${size / 2}, ${size / 2}`}
                  rotation={-90}
                />
              );
              offset += length;
              return element;
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
});
