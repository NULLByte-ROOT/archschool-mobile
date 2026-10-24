import { StyleSheet, View } from "react-native";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";

import { colors } from "@/theme/tokens";

/**
 * The app's one structural motif: a faint drafting grid.
 *
 * ArchSchool is a workspace for an architecture-minded class; a blueprint
 * underlay ties the screens together without adding a card or a gradient.
 */
export function BlueprintGrid() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="draft"
            width={32}
            height={32}
            patternUnits="userSpaceOnUse"
          >
            <Line x1={0} y1={0} x2={0} y2={32} stroke={colors.line} strokeWidth={0.6} opacity={0.55} />
            <Line x1={0} y1={0} x2={32} y2={0} stroke={colors.line} strokeWidth={0.6} opacity={0.55} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#draft)" />
      </Svg>
    </View>
  );
}
