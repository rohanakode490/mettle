import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/useHaptics';
import {
  getRoutines,
  getDayPlans,
  getSetLogs,
  insertSetLog,
  updateSetLog,
  deleteSetLog,
  getLastSetLogForExercise,
} from '@/db/queries';
import { Routine, DayPlan, SetLog } from '@/types/database';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface SetRowItem {
  id: string; // sqlite ID if logged, or temp random ID
  setType: 'work' | 'warmup' | 'dropset';
  weightKg: string;
  reps: string;
  isLogged: boolean;
  previousWeightKg?: string;
  previousReps?: string;
  // Track original values to determine if modified when clicking checkmark
  originalWeightKg?: string;
  originalReps?: string;
}

interface ExerciseWorkoutState {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  supersetId?: string;
  sets: SetRowItem[];
  isOpen: boolean;
}

export default function TodayWorkoutScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const haptics = useHaptics();

  const [loading, setLoading] = useState(true);
  const [routinesList, setRoutinesList] = useState<Routine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  
  // Mettle day index (0 = Mon, 6 = Sun)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  });

  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [exercises, setExercises] = useState<ExerciseWorkoutState[]>([]);

  // Load routines and day plans
  const loadWorkoutData = useCallback(async () => {
    try {
      setLoading(true);
      const routines = await getRoutines(db);
      setRoutinesList(routines);
      if (routines.length > 0) {
        const activeRoutine = routines[0];
        setSelectedRoutine(activeRoutine);
        
        // Fetch plans for this routine
        const plans = await getDayPlans(db, activeRoutine.id);
        const planForDay = plans.find(p => p.dayIndex === selectedDayIndex) || null;
        setDayPlan(planForDay);

        if (planForDay && !planForDay.isRest) {
          // Fetch existing set logs for today
          const todayLogs = await getSetLogs(db, activeRoutine.id, selectedDayIndex);
          
          // Map plans to state with sets
          const exerciseStates: ExerciseWorkoutState[] = [];
          
          for (const exPlan of planForDay.exercisePlans) {
            const targetSetsNum = parseInt(exPlan.targetSets, 10) || 3;
            
            // Get logs today for this specific exercise
            const exLogsToday = todayLogs.filter(
              log => log.exerciseName.toLowerCase() === exPlan.name.toLowerCase()
            );

            // Fetch last completed set log for history hint
            const lastLog = await getLastSetLogForExercise(db, exPlan.name);
            const prevWeight = lastLog ? String(lastLog.weightKg) : undefined;
            const prevReps = lastLog ? String(lastLog.reps) : undefined;

            const sets: SetRowItem[] = [];
            const totalSetsToShow = Math.max(targetSetsNum, exLogsToday.length);

            for (let i = 0; i < totalSetsToShow; i++) {
              if (i < exLogsToday.length) {
                const log = exLogsToday[i];
                sets.push({
                  id: log.id,
                  setType: log.setType,
                  weightKg: String(log.weightKg),
                  reps: String(log.reps),
                  isLogged: true,
                  previousWeightKg: prevWeight,
                  previousReps: prevReps,
                  originalWeightKg: String(log.weightKg),
                  originalReps: String(log.reps),
                });
              } else {
                sets.push({
                  id: `temp-${exPlan.id}-${i}-${Math.random().toString(36).substr(2, 9)}`,
                  setType: 'work',
                  weightKg: '',
                  reps: '',
                  isLogged: false,
                  previousWeightKg: prevWeight,
                  previousReps: prevReps,
                });
              }
            }

            exerciseStates.push({
              id: exPlan.id,
              name: exPlan.name,
              targetSets: targetSetsNum,
              targetReps: exPlan.targetReps,
              supersetId: exPlan.supersetId,
              sets,
              isOpen: true, // Keep accordions open by default
            });
          }

          setExercises(exerciseStates);
        } else {
          setExercises([]);
        }
      }
    } catch (error) {
      console.error('Error loading workout data:', error);
    } finally {
      setLoading(false);
    }
  }, [db, selectedDayIndex]);

  useEffect(() => {
    loadWorkoutData();
  }, [loadWorkoutData]);

  // Handle Set Type Cycles
  const handleCycleSetType = (exIndex: number, setIndex: number) => {
    haptics.triggerLight();
    setExercises(prev => {
      const next = [...prev];
      const set = next[exIndex].sets[setIndex];
      const types: ('work' | 'warmup' | 'dropset')[] = ['work', 'warmup', 'dropset'];
      const currentIndex = types.indexOf(set.setType);
      const nextIndex = (currentIndex + 1) % types.length;
      set.setType = types[nextIndex];
      return next;
    });
  };

  // Input Handlers
  const handleInputChange = (
    exIndex: number,
    setIndex: number,
    field: 'weightKg' | 'reps',
    val: string
  ) => {
    // Regex validations
    if (field === 'weightKg') {
      const cleanVal = val.replace(/[^0-9.]/g, '');
      const parts = cleanVal.split('.');
      if (parts.length > 2) return; // Allow only one decimal point
      if (parts[1] && parts[1].length > 1) return; // Allow only one digit after decimal
      val = cleanVal;
    } else {
      val = val.replace(/[^0-9]/g, ''); // Integers only
    }

    setExercises(prev => {
      const next = [...prev];
      next[exIndex].sets[setIndex][field] = val;
      return next;
    });
  };

  // Toggle Checkmark (Log/Unlog/Update)
  const handleToggleCheckmark = async (exIndex: number, setIndex: number) => {
    if (!selectedRoutine) return;
    const ex = exercises[exIndex];
    const set = ex.sets[setIndex];
    const w = parseFloat(set.weightKg);
    const r = parseInt(set.reps, 10);

    // Strict Validation: No zero or empty weights/reps log
    if (isNaN(w) || w <= 0 || isNaN(r) || r <= 0) {
      Alert.alert('Validation Error', 'Weight and Reps must be greater than 0.');
      return;
    }

    try {
      if (set.isLogged) {
        // Edge Case 4.1: If weight & reps are NOT modified, uncheck acts as deletion
        const isModified =
          set.weightKg !== set.originalWeightKg || set.reps !== set.originalReps;

        if (!isModified) {
          // DELETE set log
          await deleteSetLog(db, set.id);
          haptics.triggerLight();

          setExercises(prev => {
            const next = [...prev];
            const targetSet = next[exIndex].sets[setIndex];
            targetSet.isLogged = false;
            targetSet.weightKg = '';
            targetSet.reps = '';
            targetSet.originalWeightKg = undefined;
            targetSet.originalReps = undefined;
            return next;
          });
        } else {
          // Edge Case 4.2: If modified, update DB
          await updateSetLog(db, set.id, w, r);
          haptics.triggerLight();

          setExercises(prev => {
            const next = [...prev];
            const targetSet = next[exIndex].sets[setIndex];
            targetSet.originalWeightKg = set.weightKg;
            targetSet.originalReps = set.reps;
            return next;
          });
        }
      } else {
        // Create new SetLog
        const newLogId = set.id.startsWith('temp-')
          ? `log-${Math.random().toString(36).substr(2, 9)}`
          : set.id;

        const newLog: SetLog = {
          id: newLogId,
          exerciseName: ex.name,
          weightKg: w,
          reps: r,
          timestamp: Date.now(),
          routineId: selectedRoutine.id,
          dayIndex: selectedDayIndex,
          setType: set.setType,
          supersetId: ex.supersetId,
        };

        await insertSetLog(db, newLog);
        haptics.triggerSuccess();

        setExercises(prev => {
          const next = [...prev];
          const targetSet = next[exIndex].sets[setIndex];
          targetSet.id = newLogId;
          targetSet.isLogged = true;
          targetSet.originalWeightKg = set.weightKg;
          targetSet.originalReps = set.reps;
          return next;
        });
      }
    } catch (err) {
      console.error('Error logging set:', err);
    }
  };

  // Add Extra Set Row UI
  const handleAddExtraSet = (exIndex: number) => {
    haptics.triggerLight();
    setExercises(prev => {
      const next = [...prev];
      const ex = next[exIndex];
      
      // Get previous hints if available
      const firstSet = ex.sets[0];
      const prevWeight = firstSet?.previousWeightKg;
      const prevReps = firstSet?.previousReps;

      ex.sets.push({
        id: `temp-${ex.id}-extra-${Math.random().toString(36).substr(2, 9)}`,
        setType: 'work',
        weightKg: '',
        reps: '',
        isLogged: false,
        previousWeightKg: prevWeight,
        previousReps: prevReps,
      });
      return next;
    });
  };

  // Swipe to Delete
  const handleDeleteRow = async (exIndex: number, setIndex: number) => {
    const set = exercises[exIndex].sets[setIndex];
    
    try {
      if (set.isLogged) {
        await deleteSetLog(db, set.id);
      }
      haptics.triggerLight();

      setExercises(prev => {
        const next = [...prev];
        next[exIndex].sets.splice(setIndex, 1);
        return next;
      });
    } catch (err) {
      console.error('Error deleting set row:', err);
    }
  };

  // Workout Day Completion
  const handleCompleteWorkout = () => {
    haptics.triggerSuccess();
    Alert.alert(
      'Workout Completed! 🎉',
      'Great job finishing your routine. Your success haptic feedback has triggered.',
      [{ text: 'Awesome' }]
    );
  };

  // Toggle Accordion Collapse
  const toggleAccordion = (index: number) => {
    setExercises(prev => {
      const next = [...prev];
      next[index].isOpen = !next[index].isOpen;
      return next;
    });
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.textPrimary} />
      </ThemedView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {/* Days of Week Row */}
          <View style={styles.daySelectorRow}>
            {DAYS_OF_WEEK.map((dayName, idx) => {
              const isActive = selectedDayIndex === idx;
              return (
                <Pressable
                  key={dayName}
                  onPress={() => setSelectedDayIndex(idx)}
                  style={[
                    styles.dayButton,
                    isActive && { backgroundColor: theme.textSecondary + '22', borderColor: theme.textSecondary }
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      { color: theme.textSecondary },
                      isActive && { color: theme.text, fontWeight: 'bold' }
                    ]}>
                    {dayName}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Main Workout List */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            
            {dayPlan?.isRest ? (
              <View style={styles.restDayContainer}>
                <Text style={[styles.restDayText, { color: theme.text }]}>
                  Today is a Rest Day 🧘
                </Text>
                <Text style={[styles.restDaySubtext, { color: theme.textSecondary }]}>
                  Take it easy and recover, or select another day above to log logs.
                </Text>
              </View>
            ) : exercises.length === 0 ? (
              <View style={styles.restDayContainer}>
                <Text style={[styles.restDayText, { color: theme.text }]}>
                  No routine scheduled for today.
                </Text>
              </View>
            ) : (
              exercises.map((ex, exIdx) => {
                const isSuperset = !!ex.supersetId;
                
                return (
                  <Animated.View
                    entering={FadeIn}
                    layout={Layout.springify()}
                    key={ex.id}
                    style={[
                      styles.exerciseCard,
                      { borderColor: theme.textSecondary + '1a', backgroundColor: theme.backgroundElement },
                      isSuperset && { borderColor: theme.textSecondary, borderWidth: 1 }
                    ]}>
                    {/* Accordion Heading */}
                    <Pressable
                      style={styles.cardHeader}
                      onPress={() => toggleAccordion(exIdx)}>
                      <View style={{ flex: 1 }}>
                        {isSuperset && (
                          <Text style={[styles.supersetTag, { color: theme.textSecondary }]}>
                            SUPERSET MEMBER
                          </Text>
                        )}
                        <Text style={[styles.exerciseTitle, { color: theme.text }]}>
                          {ex.name}
                        </Text>
                        <Text style={[styles.exerciseSubtitle, { color: theme.textSecondary }]}>
                          Target: {ex.targetSets} sets × {ex.targetReps} reps
                        </Text>
                      </View>
                      <SymbolView
                        name={ex.isOpen ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
                        size={16}
                        tintColor={theme.text}
                      />
                    </Pressable>

                    {/* Accordion Content */}
                    {ex.isOpen && (
                      <View style={styles.cardContent}>
                        {/* Table Headers */}
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.headerCell, styles.cellSet, { color: theme.textSecondary }]}>SET</Text>
                          <Text style={[styles.headerCell, styles.cellType, { color: theme.textSecondary }]}>TYPE</Text>
                          <Text style={[styles.headerCell, styles.cellPrev, { color: theme.textSecondary }]}>PREV</Text>
                          <Text style={[styles.headerCell, styles.cellInput, { color: theme.textSecondary }]}>KG</Text>
                          <Text style={[styles.headerCell, styles.cellInput, { color: theme.textSecondary }]}>REPS</Text>
                          <Text style={[styles.headerCell, styles.cellCheck, { color: theme.textSecondary }]}></Text>
                        </View>

                        {/* Set Rows */}
                        {ex.sets.map((set, setIdx) => {
                          const renderRightActions = () => (
                            <Pressable
                              onPress={() => handleDeleteRow(exIdx, setIdx)}
                              style={styles.deleteButtonAction}>
                              <SymbolView
                                name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                                size={18}
                                tintColor="#ef4444"
                              />
                            </Pressable>
                          );

                          // Type badges
                          const renderTypeBadge = () => {
                            let text = 'W';
                            let badgeStyle = styles.badgeWork;
                            if (set.setType === 'warmup') {
                              text = 'WU';
                              badgeStyle = styles.badgeWarmup;
                            } else if (set.setType === 'dropset') {
                              text = 'DS';
                              badgeStyle = styles.badgeDropset;
                            }

                            return (
                              <Pressable
                                onPress={() => handleCycleSetType(exIdx, setIdx)}
                                style={[styles.typeBadge, badgeStyle]}>
                                <Text style={styles.typeBadgeText}>{text}</Text>
                              </Pressable>
                            );
                          };

                          return (
                            <Swipeable
                              key={set.id}
                              renderRightActions={renderRightActions}
                              containerStyle={{ overflow: 'visible' }}>
                              <View style={[
                                styles.setRow,
                                { borderBottomColor: theme.textSecondary + '0f' },
                                set.isLogged && { backgroundColor: theme.textSecondary + '08' }
                              ]}>
                                <Text style={[styles.cellSet, styles.setNumberText, { color: theme.text }]}>
                                  {setIdx + 1}
                                </Text>
                                <View style={styles.cellType}>
                                  {renderTypeBadge()}
                                </View>
                                <Text style={[styles.cellPrev, styles.prevHintText, { color: theme.textSecondary }]}>
                                  {set.previousWeightKg && set.previousReps
                                    ? `${set.previousWeightKg} × ${set.previousReps}`
                                    : '—'}
                                </Text>
                                
                                <TextInput
                                  value={set.weightKg}
                                  onChangeText={(val) => handleInputChange(exIdx, setIdx, 'weightKg', val)}
                                  placeholder={set.previousWeightKg || '0'}
                                  placeholderTextColor={theme.textSecondary + '66'}
                                  keyboardType="numeric"
                                  style={[styles.cellInput, styles.inputField, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
                                  editable={!set.isLogged}
                                />

                                <TextInput
                                  value={set.reps}
                                  onChangeText={(val) => handleInputChange(exIdx, setIdx, 'reps', val)}
                                  placeholder={set.previousReps || '0'}
                                  placeholderTextColor={theme.textSecondary + '66'}
                                  keyboardType="numeric"
                                  style={[styles.cellInput, styles.inputField, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
                                  editable={!set.isLogged}
                                />

                                <Pressable
                                  onPress={() => handleToggleCheckmark(exIdx, setIdx)}
                                  style={styles.cellCheck}>
                                  <SymbolView
                                    name={set.isLogged
                                      ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                                      : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }
                                    }
                                    size={22}
                                    tintColor={set.isLogged ? '#10b981' : theme.textSecondary}
                                  />
                                </Pressable>
                              </View>
                            </Swipeable>
                          );
                        })}

                        {/* Add Extra Set Button */}
                        <Pressable
                          onPress={() => handleAddExtraSet(exIdx)}
                          style={[styles.addSetButton, { borderColor: theme.textSecondary + '33' }]}>
                          <Text style={[styles.addSetButtonText, { color: theme.text }]}>
                            + ADD EXTRA SET
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </Animated.View>
                );
              })
            )}

            {/* Complete Workout Button */}
            {!dayPlan?.isRest && exercises.length > 0 && (
              <Pressable
                onPress={handleCompleteWorkout}
                style={[styles.completeWorkoutButton, { backgroundColor: theme.textSecondary }]}>
                <Text style={styles.completeWorkoutButtonText}>
                  COMPLETE WORKOUT
                </Text>
              </Pressable>
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
  },
  daySelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  dayButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 40,
    alignItems: 'center',
  },
  dayText: {
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.four,
  },
  restDayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.eight,
    gap: Spacing.two,
  },
  restDayText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  restDaySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: Spacing.six,
  },
  exerciseCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
  },
  supersetTag: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  exerciseSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  cardContent: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingBottom: Spacing.three,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  headerCell: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  cellSet: {
    width: 30,
    textAlign: 'center',
  },
  setNumberText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  cellType: {
    width: 45,
    alignItems: 'center',
  },
  cellPrev: {
    flex: 1,
    textAlign: 'center',
  },
  prevHintText: {
    fontSize: 12,
  },
  cellInput: {
    width: 55,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  cellCheck: {
    width: 40,
    alignItems: 'center',
  },
  inputField: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingVertical: 4,
    fontSize: 13,
    height: 28,
  },
  typeBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  badgeWork: {
    backgroundColor: '#0d9488', // Teal 600
  },
  badgeWarmup: {
    backgroundColor: '#f59e0b', // Yellow 500
  },
  badgeDropset: {
    backgroundColor: '#ef4444', // Red 500
  },
  deleteButtonAction: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: '100%',
  },
  addSetButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.two,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  completeWorkoutButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  completeWorkoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
