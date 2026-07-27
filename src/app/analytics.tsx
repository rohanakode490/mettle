import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import Svg, { Path, Circle, Line } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getAllSetLogs } from '@/db/queries';


interface VolumeDataPoint {
  dateLabel: string;
  volume: number;
}

interface Exercise1RM {
  exerciseName: string;
  max1RM: number;
}

export default function AnalyticsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [max1RMVal, setMax1RMVal] = useState(0);
  const [exercise1RMs, setExercise1RMs] = useState<Exercise1RM[]>([]);
  const [volumeHistory, setVolumeHistory] = useState<VolumeDataPoint[]>([]);

  // Calculate statistics
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const allLogs = await getAllSetLogs(db);

      if (allLogs.length === 0) {
        setTotalWorkouts(0);
        setTotalVolume(0);
        setMax1RMVal(0);
        setExercise1RMs([]);
        setVolumeHistory([]);
        return;
      }

      // Group logs by Date to count workouts and calculate daily volume
      const dailyVolumeMap: { [key: string]: number } = {};
      let calculatedTotalVolume = 0;
      let absoluteMax1RM = 0;
      const exerciseMax1RMMap: { [key: string]: number } = {};

      allLogs.forEach(log => {
        // Date grouping
        const date = new Date(log.timestamp);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const setVolume = log.weightKg * log.reps;
        calculatedTotalVolume += setVolume;

        dailyVolumeMap[dateKey] = (dailyVolumeMap[dateKey] || 0) + setVolume;

        // Estimated 1RM = Weight * (1 + Reps/30)
        const est1RM = log.weightKg * (1 + log.reps / 30);
        if (est1RM > absoluteMax1RM) {
          absoluteMax1RM = est1RM;
        }

        // Exercise specific max 1RM
        const exName = log.exerciseName;
        if (!exerciseMax1RMMap[exName] || est1RM > exerciseMax1RMMap[exName]) {
          exerciseMax1RMMap[exName] = est1RM;
        }
      });

      // Set summaries
      setTotalWorkouts(Object.keys(dailyVolumeMap).length);
      setTotalVolume(Math.round(calculatedTotalVolume));
      setMax1RMVal(Math.round(absoluteMax1RM));

      // Leaderboard
      const leaderboard = Object.keys(exerciseMax1RMMap).map(name => ({
        exerciseName: name,
        max1RM: Math.round(exerciseMax1RMMap[name]),
      }));
      setExercise1RMs(leaderboard.sort((a, b) => b.max1RM - a.max1RM));

      // Volume history data points (sorted chronological)
      const sortedDates = Object.keys(dailyVolumeMap).sort();
      const points = sortedDates.map(dateKey => {
        const parts = dateKey.split('-');
        const label = `${parts[1]}/${parts[2]}`; // MM/DD
        return {
          dateLabel: label,
          volume: Math.round(dailyVolumeMap[dateKey]),
        };
      });
      setVolumeHistory(points.slice(-7)); // Show last 7 workouts
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadAnalytics();
    });
  }, [loadAnalytics]);

  // Render premium Custom SVG Chart
  const renderChart = () => {
    if (volumeHistory.length === 0) return null;

    const screenWidth = Dimensions.get('window').width - Spacing.four * 2 - Spacing.four * 2;
    const chartHeight = 160;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 20;
    const paddingBottom = 30;

    const graphWidth = screenWidth - paddingLeft - paddingRight;
    const graphHeight = chartHeight - paddingTop - paddingBottom;

    // Find min/max values
    const volumes = volumeHistory.map(p => p.volume);
    const maxVal = Math.max(...volumes) * 1.1; // Add 10% spacing top
    const minVal = 0;

    // Map points to SVG coordinates
    const coords = volumeHistory.map((point, index) => {
      const x = paddingLeft + (index / (volumeHistory.length - 1 || 1)) * graphWidth;
      const y = paddingTop + graphHeight - ((point.volume - minVal) / (maxVal - minVal || 1)) * graphHeight;
      return { x, y, label: point.dateLabel, volume: point.volume };
    });

    // Build path line
    let pathD = '';
    coords.forEach((coord, idx) => {
      if (idx === 0) {
        pathD += `M ${coord.x} ${coord.y}`;
      } else {
        pathD += ` L ${coord.x} ${coord.y}`;
      }
    });

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>Workout Volume Progression (kg)</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: Spacing.three }}>
          Total load lifted over your last {volumeHistory.length} training sessions.
        </Text>

        <Svg width={screenWidth} height={chartHeight}>
          {/* Y Axis Gridlines */}
          {[0, 0.5, 1].map((ratio, gridIdx) => {
            const val = Math.round(maxVal * ratio);
            const y = paddingTop + graphHeight - ratio * graphHeight;
            return (
              <React.Fragment key={gridIdx}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={screenWidth - paddingRight}
                  y2={y}
                  stroke={theme.textSecondary + '11'}
                  strokeWidth="1"
                />
                <Text
                  style={[
                    styles.yAxisLabel,
                    {
                      color: theme.textSecondary,
                      left: 0,
                      top: y - 6,
                      position: 'absolute',
                    },
                  ]}>
                  {val}
                </Text>
              </React.Fragment>
            );
          })}

          {/* Grid line boundary */}
          <Line
            x1={paddingLeft}
            y1={paddingTop + graphHeight}
            x2={screenWidth - paddingRight}
            y2={paddingTop + graphHeight}
            stroke={theme.textSecondary + '33'}
            strokeWidth="1.5"
          />

          {/* The Path Line */}
          {coords.length > 1 && (
            <Path
              d={pathD}
              fill="none"
              stroke={theme.brandAccent}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* Points & Labels */}
          {coords.map((coord, idx) => (
            <React.Fragment key={idx}>
              <Circle
                cx={coord.x}
                cy={coord.y}
                r="4.5"
                fill={theme.brandAccent}
                stroke={theme.backgroundElement}
                strokeWidth="1.5"
              />
              {/* Date X Labels */}
              <Text
                style={[
                  styles.xAxisLabel,
                  {
                    color: theme.textSecondary,
                    left: coord.x - 14,
                    top: paddingTop + graphHeight + 6,
                    position: 'absolute',
                  },
                ]}>
                {coord.label}
              </Text>
            </React.Fragment>
          ))}
        </Svg>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.text} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Analytics</ThemedText>
        </ThemedView>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {totalWorkouts === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                Complete a workout checklist row in the Home screen to view analytics stats.
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.four }}>
              
              {/* Statistics Grid */}
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{totalWorkouts}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>WORKOUTS</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>TOTAL KG</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{max1RMVal} kg</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>PEAK 1RM</Text>
                </View>
              </View>

              {/* Progress Chart */}
              {renderChart()}

              {/* Estimated 1RM Leaderboard */}
              <View style={styles.leaderboardSection}>
                <Text style={[styles.leaderboardTitle, { color: theme.textSecondary }]}>
                  ESTIMATED 1RM PERSONAL RECORDS
                </Text>

                <View style={[styles.leaderboardList, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
                  {exercise1RMs.map((item, idx) => {
                    const isLast = idx === exercise1RMs.length - 1;
                    return (
                      <View
                        key={item.exerciseName}
                        style={[
                          styles.leaderboardRow,
                          !isLast && { borderBottomColor: theme.textSecondary + '0f', borderBottomWidth: 1 },
                        ]}>
                        <Text style={[styles.leaderboardExName, { color: theme.text }]}>
                          {item.exerciseName}
                        </Text>
                        <Text style={[styles.leaderboardValue, { color: theme.brandAccent }]}>
                          {item.max1RM} kg
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  chartCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  yAxisLabel: {
    fontSize: 8,
    textAlign: 'right',
    width: 32,
  },
  xAxisLabel: {
    fontSize: 8,
    textAlign: 'center',
    width: 28,
  },
  leaderboardSection: {
    gap: Spacing.two,
  },
  leaderboardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    paddingLeft: Spacing.one,
  },
  leaderboardList: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
  },
  leaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  leaderboardExName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  leaderboardValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
