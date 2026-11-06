import { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Path, Svg, LinearGradient, Stop, Defs } from 'react-native-svg';
import { marketStore, useMarketVersion } from '../../../store/marketStore';

interface PriceChartProps {
  symbol: string;
  maxPoints?: number;
  height?: number;
}

const MAX_POINTS = 600;
const UPDATE_INTERVAL_MS = 250;

export function PriceChart({ symbol, maxPoints = MAX_POINTS, height = 180 }: PriceChartProps) {
  const theme = useTheme();
  const version = useMarketVersion(UPDATE_INTERVAL_MS);

  const pointsRef = useRef<Array<{ x: number; y: number; price: number }>>([]);
  const minMaxRef = useRef({ min: Infinity, max: -Infinity });

  // Get latest quote and add to buffer
  useEffect(() => {
    const quote = marketStore.getState().quotes.get(symbol);
    if (quote && quote.ltpPaise) {
      const price = quote.ltpPaise / 100; // convert paise to rupees for display
      const x = pointsRef.current.length;
      pointsRef.current.push({ x, y: 0, price });
      minMaxRef.current.min = Math.min(minMaxRef.current.min, price);
      minMaxRef.current.max = Math.max(minMaxRef.current.max, price);

      if (pointsRef.current.length > maxPoints) {
        pointsRef.current.shift();
        // Recalculate min/max when shifting (simplified - acceptable for 600 pts)
        if (pointsRef.current.length > 0) {
          minMaxRef.current.min = Math.min(...pointsRef.current.map(p => p.price));
          minMaxRef.current.max = Math.max(...pointsRef.current.map(p => p.price));
        }
      }
    }
  }, [symbol, version]);

  // Calculate y positions for all points
  const points = useMemo(() => {
    if (pointsRef.current.length === 0) return [];

    const { min, max } = minMaxRef.current;
    const range = max - min || 1; // avoid div by zero
    const padding = range * 0.1; // 10% padding
    const paddedMin = min - padding;
    const paddedMax = max + padding;
    const paddedRange = paddedMax - paddedMin;

    return pointsRef.current.map((pt, i) => ({
      x: i,
      y: ((pt.price - paddedMin) / paddedRange) * height,
      price: pt.price,
    }));
  }, [height, version]);

  // Build SVG path
  const pathData = useMemo(() => {
    if (points.length < 2) return { line: '', fill: '' };
    const line = points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${height - pt.y}`)
      .join(' ');
    // Close for gradient fill
    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    const fill = lastPt && firstPt
      ? `${line} L ${lastPt.x} ${height} L ${firstPt.x} ${height} Z`
      : '';
    return { line, fill };
  }, [points, height]);

  if (points.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>No ticks yet</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} style={styles.svg}>
        <Defs>
          {pathData.fill && (
            <LinearGradient
              id="priceGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop offset="0%" stopColor={theme.colors.accentMuted} stopOpacity={1} />
              <Stop offset="100%" stopColor={theme.colors.accentMuted} stopOpacity={0} />
            </LinearGradient>
          )}
        </Defs>
        {pathData.fill && (
          <Path d={pathData.fill} fill="url(#priceGradient)" />
        )}
        <Path
          d={pathData.line}
          fill="none"
          stroke={theme.colors.accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  svg: { width: '100%', height: '100%' },
  emptyText: {
    textAlign: 'center',
    marginTop: '50%',
  },
});