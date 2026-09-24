import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import {
  CalendarIcon,
  TrashIcon,
  FlameIcon,
  ListIcon,
  RestIcon,
} from '@/components/svg-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/useHaptics';
import {
  getAllSetLogs,
  deleteSetLog,
  getRoutines,
  getDayPlans,
} from '@/db/queries';
import { SetLog } from '@/types/database';
import { SyncService } from '@/supabase/syncService';
import { useWeightUnit } from '@/context/weight-unit-context';
import { formatWeight } from '@/utils/weight';
import {
  StreakInfo,
  formatDateKey,
  calculateWeeklyStreak,
} from '@/utils/streak';
import {
  getMonthCalendarGrid,
  formatMonthYear,
} from '@/utils/calendar';

interface GroupedLogs {
  dateString: string;
  logs: SetLog[];
}

const WEEKDAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const haptics = useHaptics();
  const { unit } = useWeightUnit();

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs[]>([]);
  const [rawLogs, setRawLogs] = useState<SetLog[]>([]);

  // Streak & Planning State
  const [streakInfo, setStreakInfo] = useState<StreakInfo>(() =>
    calculateWeeklyStreak([])
  );
  const [plannedRestDays, setPlannedRestDays] = useState<Set<number>>(new Set());

  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    formatDateKey(new Date())
  );

  // Load history data
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const allLogs = await getAllSetLogs(db);
      setRawLogs(allLogs);

      // Determine target workout days from active routine
      let targetDays = 3;
      const restDaysSet = new Set<number>();
      try {
        const routines = await getRoutines(db);
        if (routines.length > 0) {
          const activeRoutine = routines[0];
          const plans = await getDayPlans(db, activeRoutine.id);
          const workoutPlans = plans.filter(p => !p.isRest && p.exercisePlans.length > 0);
          if (workoutPlans.length > 0) {
            targetDays = workoutPlans.length;
          }
          plans.forEach(p => {
            if (p.isRest || p.exercisePlans.length === 0) {
              restDaysSet.add(p.dayIndex);
            }
          });
        }
      } catch (err) {
        console.warn('Could not load routine for streak calculation:', err);
      }
      setPlannedRestDays(restDaysSet);

      // Calculate weekly streak
      const calculatedStreak = calculateWeeklyStreak(allLogs, targetDays);
      setStreakInfo(calculatedStreak);

      // Group logs by Date (for List view)
      const groups: { [key: string]: SetLog[] } = {};
      allLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        if (!groups[dateStr]) {
          groups[dateStr] = [];
        }
        groups[dateStr].push(log);
      });

      const groupedArray = Object.keys(groups).map(dateString => ({
        dateString,
        logs: groups[dateString],
      }));

      setGroupedLogs(groupedArray);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadHistory();
    });
  }, [loadHistory]);

  // Handle Log Deletion
  const handleDeleteLog = async (logId: string) => {
    try {
      await deleteSetLog(db, logId);
      haptics.triggerLight();
      SyncService.deleteRemoteSetLog(logId).catch(err => console.warn(err));
      loadHistory();
    } catch (err) {
      console.error('Error deleting set log:', err);
    }
  };

  // Map of dateKey -> SetLog[] for quick calendar lookup
  const workoutLogsByDate = useMemo(() => {
    const map: Record<string, SetLog[]> = {};
    for (const log of rawLogs) {
      const key = formatDateKey(new Date(log.timestamp));
      if (!map[key]) map[key] = [];
      map[key].push(log);
    }
    return map;
  }, [rawLogs]);

  // Calendar grid calculation
  const calendarGrid = useMemo(() => {
    return getMonthCalendarGrid(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth()
    );
  }, [currentMonthDate]);

  // Selected date logs
  const selectedDateLogs = useMemo(() => {
    return workoutLogsByDate[selectedDateKey] || [];
  }, [workoutLogsByDate, selectedDateKey]);

  // Selected date object
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDateKey]);

  const isSelectedDayPlannedRest = useMemo(() => {
    const dayIndex = selectedDateObj.getDay() === 0 ? 6 : selectedDateObj.getDay() - 1;
    return plannedRestDays.has(dayIndex);
  }, [selectedDateObj, plannedRestDays]);

  const handlePrevMonth = () => {
    haptics.triggerLight();
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    haptics.triggerLight();
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    haptics.triggerLight();
    const today = new Date();
    setCurrentMonthDate(today);
    setSelectedDateKey(formatDateKey(today));
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.text} />
      </ThemedView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="title">Workout History</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Track your consistency, streaks, and previous sets.
                </ThemedText>
              </View>

              {/* View Switcher Toggle */}
              <View style={[styles.viewSwitcher, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '22' }]}>
                <Pressable
                  onPress={() => {
                    setViewMode('calendar');
                    haptics.triggerLight();
                  }}
                  style={[
                    styles.switcherTab,
                    viewMode === 'calendar' && [styles.switcherTabActive, { backgroundColor: theme.brandAccent }]
                  ]}>
                  <CalendarIcon size={16} color={viewMode === 'calendar' ? '#ffffff' : theme.textSecondary} />
                </Pressable>

                <Pressable
                  onPress={() => {
                    setViewMode('list');
                    haptics.triggerLight();
                  }}
                  style={[
                    styles.switcherTab,
                    viewMode === 'list' && [styles.switcherTabActive, { backgroundColor: theme.brandAccent }]
                  ]}>
                  <ListIcon size={16} color={viewMode === 'list' ? '#ffffff' : theme.textSecondary} />
                </Pressable>
              </View>
            </View>
          </ThemedView>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* Streak & Consistency Banner */}
            <View style={[styles.streakCard, { backgroundColor: theme.backgroundElement, borderColor: theme.brandAccent + '33' }]}>
              <View style={styles.streakTopRow}>
                <View style={[styles.flameIconContainer, { backgroundColor: theme.brandAccent + '22' }]}>
                  <FlameIcon size={24} color={theme.brandAccent} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                    <Text style={[styles.streakNumber, { color: theme.text }]}>
                      {streakInfo.currentStreakWeeks} {streakInfo.currentStreakWeeks === 1 ? 'Week' : 'Weeks'}
                    </Text>
                    <View style={[
                      styles.streakBadge,
                      {
                        backgroundColor: streakInfo.isCurrentWeekMet
                          ? '#10b98122'
                          : streakInfo.isCurrentWeekViable
                          ? theme.brandAccent + '22'
                          : '#ef444422'
                      }
                    ]}>
                      <Text style={[
                        styles.streakBadgeText,
                        {
                          color: streakInfo.isCurrentWeekMet
                            ? '#10b981'
                            : streakInfo.isCurrentWeekViable
                            ? theme.brandAccent
                            : '#ef4444'
                        }
                      ]}>
                        {streakInfo.isCurrentWeekMet ? 'GOAL MET' : streakInfo.isCurrentWeekViable ? 'ON TRACK' : 'RESET'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.streakSubtitle, { color: theme.textSecondary }]}>
                    {streakInfo.workoutsThisWeek} of {streakInfo.targetWorkoutsPerWeek} workouts completed this week
                  </Text>
                </View>

                <View style={styles.longestStreakCol}>
                  <Text style={[styles.longestStreakValue, { color: theme.brandAccent }]}>
                    {streakInfo.longestStreakWeeks}w
                  </Text>
                  <Text style={[styles.longestStreakLabel, { color: theme.textSecondary }]}>BEST</Text>
                </View>
              </View>

              {/* Weekly Goal Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.round((streakInfo.workoutsThisWeek / Math.max(1, streakInfo.targetWorkoutsPerWeek)) * 100))}%`,
                      backgroundColor: streakInfo.isCurrentWeekMet ? '#10b981' : theme.brandAccent,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.streakTip, { color: theme.textSecondary }]}>
                {"Planned rest days don't break your streak! Hit your weekly workout target to keep it active."}
              </Text>
            </View>

            {/* CALENDAR VIEW */}
            {viewMode === 'calendar' && (
              <View style={{ gap: Spacing.four }}>
                {/* Month Calendar Card */}
                <View style={[styles.calendarCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
                  {/* Month Navigation Row */}
                  <View style={styles.monthNavRow}>
                    <Pressable
                      onPress={handlePrevMonth}
                      hitSlop={8}
                      style={[styles.monthNavBtn, { backgroundColor: theme.backgroundSelected }]}>
                      <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>‹</Text>
                    </Pressable>

                    <Text style={[styles.monthYearTitle, { color: theme.text }]}>
                      {formatMonthYear(currentMonthDate)}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                      <Pressable
                        onPress={handleGoToday}
                        style={[styles.todayBtn, { borderColor: theme.brandAccent + '55', backgroundColor: theme.brandAccent + '15' }]}>
                        <Text style={[styles.todayBtnText, { color: theme.brandAccent }]}>Today</Text>
                      </Pressable>

                      <Pressable
                        onPress={handleNextMonth}
                        hitSlop={8}
                        style={[styles.monthNavBtn, { backgroundColor: theme.backgroundSelected }]}>
                        <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>›</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Weekday Names Header */}
                  <View style={styles.weekdayHeaderRow}>
                    {WEEKDAY_NAMES.map(name => (
                      <Text key={name} style={[styles.weekdayHeaderText, { color: theme.textSecondary }]}>
                        {name}
                      </Text>
                    ))}
                  </View>

                  {/* Month Grid Cells */}
                  <View style={styles.gridContainer}>
                    {calendarGrid.map((dayItem) => {
                      const dayLogs = workoutLogsByDate[dayItem.dateKey] || [];
                      const hasWorkout = dayLogs.length > 0;
                      const isPlannedRest = plannedRestDays.has(dayItem.dayOfWeek);
                      const isSelected = dayItem.dateKey === selectedDateKey;

                      return (
                        <Pressable
                          key={dayItem.dateKey}
                          onPress={() => {
                            setSelectedDateKey(dayItem.dateKey);
                            haptics.triggerLight();
                          }}
                          style={[
                            styles.dayCell,
                            !dayItem.isCurrentMonth && { opacity: 0.3 },
                            isSelected && [
                              styles.dayCellSelected,
                              { borderColor: theme.brandAccent, backgroundColor: theme.brandAccent + '18' },
                            ],
                            dayItem.isToday && !isSelected && [
                              styles.dayCellToday,
                              { borderColor: theme.textSecondary + '44' },
                            ],
                          ]}>
                          <Text
                            style={[
                              styles.dayNumberText,
                              {
                                color: isSelected
                                  ? theme.brandAccent
                                  : dayItem.isToday
                                  ? theme.text
                                  : theme.textSecondary,
                                fontWeight: (isSelected || dayItem.isToday || hasWorkout) ? 'bold' : 'normal',
                              },
                            ]}>
                            {dayItem.dayNumber}
                          </Text>

                          {/* Status Indicators */}
                          <View style={styles.cellIndicatorContainer}>
                            {hasWorkout ? (
                              <View style={[styles.workoutDot, { backgroundColor: theme.brandAccent }]}>
                                <Text style={styles.workoutDotText}>{dayLogs.length}</Text>
                              </View>
                            ) : isPlannedRest && dayItem.isCurrentMonth ? (
                              <View style={[styles.restDot, { backgroundColor: theme.textSecondary + '33' }]} />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Calendar Legend */}
                  <View style={[styles.legendRow, { borderTopColor: theme.textSecondary + '1a' }]}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: theme.brandAccent }]} />
                      <Text style={[styles.legendText, { color: theme.textSecondary }]}>Workout</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: theme.textSecondary + '44' }]} />
                      <Text style={[styles.legendText, { color: theme.textSecondary }]}>Planned Rest</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendOutline, { borderColor: theme.brandAccent }]} />
                      <Text style={[styles.legendText, { color: theme.textSecondary }]}>Selected</Text>
                    </View>
                  </View>
                </View>

                {/* Selected Day Workout Details */}
                <View style={[styles.selectedDayCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
                  <View style={styles.selectedDayHeaderRow}>
                    <View>
                      <Text style={[styles.selectedDayTitle, { color: theme.text }]}>
                        {selectedDateObj.toLocaleDateString(undefined, {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      <Text style={[styles.selectedDaySubtitle, { color: theme.textSecondary }]}>
                        {selectedDateLogs.length > 0
                          ? `${selectedDateLogs.length} sets logged`
                          : isSelectedDayPlannedRest
                          ? 'Planned recovery day'
                          : 'No workout logged'}
                      </Text>
                    </View>

                    {selectedDateLogs.length > 0 && (
                      <View style={[styles.statusPill, { backgroundColor: '#10b98122' }]}>
                        <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 11 }}>COMPLETED</Text>
                      </View>
                    )}
                  </View>

                  {selectedDateLogs.length > 0 ? (
                    <View style={styles.selectedDaySetsList}>
                      {selectedDateLogs.map((log, index) => {
                        const isLast = index === selectedDateLogs.length - 1;
                        return (
                          <View
                            key={log.id}
                            style={[
                              styles.logRow,
                              !isLast && { borderBottomWidth: 1, borderBottomColor: theme.textSecondary + '1a' },
                            ]}>
                            <View style={styles.logLeft}>
                              <Text style={[styles.exerciseNameText, { color: theme.text }]}>
                                {log.exerciseName}
                              </Text>
                              <Text style={[
                                styles.logTypeText,
                                { color: log.setType === 'warmup' ? '#f59e0b' : log.setType === 'dropset' ? '#ef4444' : theme.brandAccent }
                              ]}>
                                {log.setType === 'work' ? 'WORKING SET' : log.setType === 'warmup' ? 'WARMUP SET' : 'DROP SET'}
                              </Text>
                            </View>

                            <View style={styles.logRightRow}>
                              <View style={styles.logRight}>
                                <Text style={[styles.logValueText, { color: theme.text }]}>
                                  {formatWeight(log.weightKg)} {unit} × {log.reps} reps
                                </Text>
                                <Text style={[styles.logTimeText, { color: theme.textSecondary }]}>
                                  {new Date(log.timestamp).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Text>
                              </View>

                              <Pressable
                                onPress={() => {
                                  Alert.alert(
                                    'Delete Set',
                                    'Are you sure you want to delete this recorded set?',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Delete',
                                        style: 'destructive',
                                        onPress: () => handleDeleteLog(log.id),
                                      },
                                    ]
                                  );
                                }}
                                hitSlop={6}
                                style={styles.trashBtn}>
                                <TrashIcon size={16} color="#ef4444" />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : isSelectedDayPlannedRest ? (
                    <View style={styles.restDayInfoBox}>
                      <RestIcon size={24} color={theme.brandAccent} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.restDayTitle, { color: theme.text }]}>Scheduled Rest Day</Text>
                        <Text style={[styles.restDayDesc, { color: theme.textSecondary }]}>
                          Scheduled recovery according to your split routine. Muscles repair and grow during rest 💤
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.emptyDayBox}>
                      <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
                        No workout sets were logged on this date.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* LIST VIEW */}
            {viewMode === 'list' && (
              groupedLogs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <CalendarIcon size={48} color={theme.textSecondary + '44'} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No workout logs found yet.
                  </Text>
                </View>
              ) : (
                groupedLogs.map(group => (
                  <View key={group.dateString} style={styles.groupCard}>
                    <Text style={[styles.groupDateHeader, { color: theme.textSecondary }]}>
                      {group.dateString}
                    </Text>

                    <View style={[styles.groupList, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
                      {group.logs.map((log, index) => {
                        const isLast = index === group.logs.length - 1;

                        const renderRightActions = () => (
                          <Pressable
                            onPress={() => handleDeleteLog(log.id)}
                            style={styles.deleteButtonAction}>
                            <TrashIcon size={18} color="#ef4444" />
                          </Pressable>
                        );

                        return (
                          <Swipeable key={log.id} renderRightActions={renderRightActions}>
                            <View
                              style={[
                                styles.logRow,
                                !isLast && { borderBottomWidth: 1, borderBottomColor: theme.textSecondary + '1a' }
                              ]}>
                              <View style={styles.logLeft}>
                                <Text style={[styles.exerciseNameText, { color: theme.text }]}>
                                  {log.exerciseName}
                                </Text>
                                <Text style={[
                                  styles.logTypeText,
                                  { color: log.setType === 'warmup' ? '#f59e0b' : log.setType === 'dropset' ? '#ef4444' : theme.brandAccent }
                                ]}>
                                  {log.setType === 'work' ? 'WORKING SET' : log.setType === 'warmup' ? 'WARMUP SET' : 'DROP SET'}
                                </Text>
                              </View>

                              <View style={styles.logRight}>
                                <Text style={[styles.logValueText, { color: theme.text }]}>
                                  {formatWeight(log.weightKg)} {unit} × {log.reps} reps
                                </Text>
                                <Text style={[styles.logTimeText, { color: theme.textSecondary }]}>
                                  {new Date(log.timestamp).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Text>
                              </View>
                            </View>
                          </Swipeable>
                        );
                      })}
                    </View>
                  </View>
                ))
              )
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </GestureHandlerRootView>
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
    marginBottom: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  viewSwitcher: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    borderWidth: 1,
    padding: 3,
  },
  switcherTab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Spacing.two - 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switcherTabActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.four,
  },
  streakCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flameIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  streakBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 4,
  },
  streakBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  streakSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  longestStreakCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  longestStreakValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  longestStreakLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  streakTip: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  calendarCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthYearTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  todayBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  weekdayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.one,
  },
  weekdayHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    width: 38,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: Spacing.one,
  },
  dayCell: {
    width: 38,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayCellSelected: {
    borderWidth: 1.5,
  },
  dayCellToday: {
    borderWidth: 1,
  },
  dayNumberText: {
    fontSize: 13,
  },
  cellIndicatorContainer: {
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  workoutDot: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutDotText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  restDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendOutline: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 11,
  },
  selectedDayCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  selectedDayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedDayTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  selectedDaySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 4,
  },
  selectedDaySetsList: {
    gap: 0,
  },
  logRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  trashBtn: {
    padding: Spacing.one,
  },
  restDayInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  restDayTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  restDayDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  emptyDayBox: {
    padding: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: 14,
  },
  groupCard: {
    gap: Spacing.two,
  },
  groupDateHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  groupList: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
  },
  logLeft: {
    flex: 1,
    gap: 2,
  },
  exerciseNameText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  logTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  logRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  logValueText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logTimeText: {
    fontSize: 11,
  },
  deleteButtonAction: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },
});
