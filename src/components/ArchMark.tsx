import Svg, { Line, Path } from "react-native-svg";

import { colors } from "@/theme/tokens";

/**
 * The ArchSchool mark: an arch on a drafting baseline.
 *
 * The same drawing is used on the login plate and as the empty-state motif, so
 * the app has one recognizable piece of geometry rather than a generic logo.
 */
export function ArchMark({
  size = 44,
  color = colors.amber,
  opacity = 1,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" opacity={opacity}>
      <Path
        d="M13 54V33a19 19 0 0 1 38 0v21"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
      <Line
        x1={6}
        y1={54}
        x2={58}
        y2={54}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Line
        x1={32}
        y1={14}
        x2={32}
        y2={54}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="3 5"
        opacity={0.38}
      />
      <Line
        x1={13}
        y1={44}
        x2={51}
        y2={44}
        stroke={color}
        strokeWidth={1}
        opacity={0.3}
      />
      <Line
        x1={8}
        y1={50}
        x2={8}
        y2={58}
        stroke={color}
        strokeWidth={1.6}
        opacity={0.7}
      />
      <Line
        x1={56}
        y1={50}
        x2={56}
        y2={58}
        stroke={color}
        strokeWidth={1.6}
        opacity={0.7}
      />
    </Svg>
  );
}
