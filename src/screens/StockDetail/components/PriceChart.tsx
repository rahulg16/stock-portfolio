import { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Path, Svg, LinearGradient, Stop, Defs, Line } from 'react-native-svg';
import { marketStore, useMarketVersion } from '../../../store/marketStore';
import { fmtINR } from '../../../shared/utils/format';

interface PriceChartProps {
  symbol: string;
  maxPoints?: number;
  height?: number;
}

const MAX_POINTS = 600;
const UPDATE_INTERVAL_MS = 250;

export function PriceChart({ symbol, maxPoints = MAX_POINTS, height = 200 }: PriceChartProps) {
  const theme = useTheme();
  const version = useMarketVersion(UPDATE_INTERVAL_MS);

  const pointsRef = useRef<Array<{ x: number; price: number }>>([]);
  const minMaxRef = useRef({ min: Infinity, max: -Infinity });

  // Get latest quote and add to buffer
  useEffect(() => {
    const quote = marketStore.getState().quotes.get(symbol);
    if (quote && quote.ltpPaise) {
      const price = quote.ltpPaise / 100; // paise to rupees
      const x = pointsRef.current.length;
      pointsRef.current.push({ x, price });
      minMaxRef.current.min = Math.min(minMaxRef.current.min, price);
      minMaxRef.current.max = Math.max(minMaxRef.current.max, price);

      if (pointsRef.current.length > maxPoints) {
        pointsRef.current.shift();
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
    const range = max - min || 1;
    const padding = range * 0.1;
    const paddedMin = min - padding;
    const paddedMax = max + padding;
    const paddedRange = paddedMax - paddedMin;

    return pointsRef.current.map((pt, i) => ({
      x: i,
      y: ((pt.price - paddedMin) / paddedRange) * height,
      price: pt.price,
    }));
  }, [height, version]);

  // Y-axis labels (min, mid, max)
  const yLabels = useMemo(() => {
    if (points.length === 0) return [];
    const { min, max } = minMaxRef.current;
    const range = max - min || 1;
    const padding = range * 0.1;
    const paddedMin = min - padding;
    const paddedMax = max + padding;
    
    return [
      { price: paddedMax, y: 0 },
      { price: (paddedMax + paddedMin) / 2, y: height / 2 },
      { price: paddedMin, y: height },
    ];
  }, [points.length, height]);

  // X-axis labels (start, middle, end time)
  const xLabels = useMemo(() => {
    if (points.length === 0) return [];
    const now = Date.now();
    const intervalMs = UPDATE_INTERVAL_MS;
    const totalMs = points.length * intervalMs;
    const startTime = now - totalMs;
    const lastX = points[points.length - 1]?.x ?? 0;
    
    return [
      { time: startTime, x: 0 },
      { time: now - totalMs / 2, x: lastX / 2 },
      { time: now, x: lastX },
    ];
  }, [points.length]);

  // Build SVG path
  const pathData = useMemo(() => {
    if (points.length < 2) return { line: '', fill: '' };
    const line = points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${height - pt.y}`)
      .join(' ');
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

  const lastPoint = points[points.length - 1];

  return (
    <View style={[styles.container, { height: height + 50 }]}>
      <View style={styles.chartWrapper}>
        {/* Y-axis labels - absolute positioned to match grid lines exactly */}
        <View style={styles.yAxis}>
          {yLabels.map((label, i) => (
            <Text
              key={i}
              style={[
                styles.yLabel,
                { 
                  color: theme.colors.textMuted, 
                  top: height - label.y - 7,
                },
              ]}
            >
              {fmtINR(Math.round(label.price * 100))}
            </Text>
          ))}
        </View>

        {/* Chart area */}
        <View style={styles.chartArea}>
          <Svg width="100%" height={height} style={styles.svg}>
            <Defs>
              {pathData.fill && (
                <LinearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={theme.colors.accentMuted} stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={theme.colors.accentMuted} stopOpacity={0} />
                </LinearGradient>
              )}
            </Defs>
            
            {/* Horizontal grid lines */}
            {yLabels.map((label, i) => (
              <Line
                key={`grid-${i}`}
                x1="0"
                y1={height - label.y}
                x2="100%"
                y2={height - label.y}
                stroke={theme.colors.border}
                strokeWidth={StyleSheet.hairlineWidth}
                strokeDasharray="4,4"
              />
            ))}

            {/* Fill gradient */}
            {pathData.fill && <Path d={pathData.fill} fill="url(#priceGradient)" />}

            {/* Line */}
            <Path
              d={pathData.line}
              fill="none"
              stroke={theme.colors.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Current price dot */}
            <Path
              d={`M ${lastPoint.x} ${height - lastPoint.y} m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0`}
              fill={theme.colors.accent}
            />
          </Svg>

          {/* X-axis labels - absolute positioned at correct x, with offset for first label */}
          <View style={styles.xAxis}>
            {xLabels.map((label, i) => {
              const isFirst = i === 0;
              const xPos = isFirst ? label.x + 25 : label.x;
              const translateX = isFirst ? 0 : -25;
              return (
                <Text
                  key={i}
                  style={[
                    styles.xLabel,
                    { 
                      color: theme.colors.textMuted, 
                      left: xPos,
                      transform: [{ translateX }],
                    },
                  ]}
                >
                  {new Date(label.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              );
            })}
          </View>
        </View>
      </View>

      {/* Current price display */}
      <View style={styles.currentPrice}>
        <Text style={[styles.currentPriceLabel, { color: theme.colors.textMuted }]}>Current</Text>
        <Text style={[styles.currentPriceValue, { color: theme.colors.text }]}>
          {fmtINR(Math.round(lastPoint.price * 100))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  chartWrapper: { flexDirection: 'row' },
  yAxis: { width: 60, position: 'relative', height: '100%' },
  yLabel: { 
    position: 'absolute', 
    right: 0, 
    fontSize: 10, 
    textAlign: 'right', 
    width: 55, 
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  chartArea: { flex: 1, position: 'relative' },
  svg: { width: '100%', height: '100%' },
  xAxis: { position: 'absolute', bottom: -16, left: 0, right: 0, height: 20 },
  xLabel: { 
    position: 'absolute', 
    top: 0, 
    fontSize: 10, 
    textAlign: 'center', 
    width: 50,
    includeFontPadding: false,
  },
  currentPrice: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    marginTop: 20, 
    paddingTop: 16, 
    borderTopWidth: StyleSheet.hairlineWidth, 
    borderTopColor: '#E0E0E0' 
  },
  currentPriceLabel: { fontSize: 12, fontWeight: '600' },
  currentPriceValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  emptyText: { textAlign: 'center', marginTop: '50%' },
});