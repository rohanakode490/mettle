import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronDownIcon, TrashIcon, CheckmarkCircleFillIcon, CircleOutlineIcon } from '@/components/svg-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { safeStorage } from '@/utils/storage';

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
  createRoutine,
  deleteRoutine,
} from '@/db/queries';
import { Routine, DayPlan, SetLog } from '@/types/database';
import { SyncService } from '@/supabase/syncService';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL_NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
  const [customPlanDayIndex, setCustomPlanDayIndex] = useState<number | null>(null);
  const [allDayPlans, setAllDayPlans] = useState<DayPlan[]>([]);
  const [swapModalVisible, setSwapModalVisible] = useState(false);

  // Routine Switcher / Modal state
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [createRoutineModalVisible, setCreateRoutineModalVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');

  const ACTIVE_ROUTINE_KEY = '@active_routine_id';

  // Load routines and day plans
  const loadWorkoutData = useCallback(async () => {
    try {
      setLoading(true);
      const routines = await getRoutines(db);
      setRoutinesList(routines);
      if (routines.length > 0) {
        let activeRoutine = routines[0];
        const savedRoutineId = await safeStorage.getItem(ACTIVE_ROUTINE_KEY);
        if (savedRoutineId) {
          const found = routines.find(r => r.id === savedRoutineId);
          if (found) {
            activeRoutine = found;
          } else {
            await safeStorage.setItem(ACTIVE_ROUTINE_KEY, activeRoutine.id);
          }
        } else {
          await safeStorage.setItem(ACTIVE_ROUTINE_KEY, activeRoutine.id);
        }
        setSelectedRoutine(activeRoutine);
        
        // Fetch plans for this routine
        const plans = await getDayPlans(db, activeRoutine.id);
        setAllDayPlans(plans);
        
        const targetPlanDayIndex = customPlanDayIndex !== null ? customPlanDayIndex : selectedDayIndex;
        const planForDay = plans.find(p => p.dayIndex === targetPlanDayIndex) || null;
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
              isOpen: true,
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
  }, [db, selectedDayIndex, customPlanDayIndex]);

  useFocusEffect(
    useCallback(() => {
      loadWorkoutData();
    }, [loadWorkoutData])
  );

  const handleSelectRoutine = async (routine: Routine) => {
    try {
      haptics.triggerLight();
      await safeStorage.setItem(ACTIVE_ROUTINE_KEY, routine.id);
      setSelectedRoutine(routine);
      setRoutineModalVisible(false);
      
      const plans = await getDayPlans(db, routine.id);
      setAllDayPlans(plans);
      
      const targetPlanDayIndex = customPlanDayIndex !== null ? customPlanDayIndex : selectedDayIndex;
      const planForDay = plans.find(p => p.dayIndex === targetPlanDayIndex) || null;
      setDayPlan(planForDay);

      if (planForDay && !planForDay.isRest) {
        const todayLogs = await getSetLogs(db, routine.id, selectedDayIndex);
        const exerciseStates: ExerciseWorkoutState[] = [];
        
        for (const exPlan of planForDay.exercisePlans) {
          const targetSetsNum = parseInt(exPlan.targetSets, 10) || 3;
          const exLogsToday = todayLogs.filter(
            log => log.exerciseName.toLowerCase() === exPlan.name.toLowerCase()
          );

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
            isOpen: true,
          });
        }
        setExercises(exerciseStates);
      } else {
        setExercises([]);
      }
    } catch (err) {
      console.error('Error selecting routine:', err);
    }
  };

  const handleCreateRoutine = async () => {
    if (!newRoutineName.trim()) {
      Alert.alert('Error', 'Please enter a routine name.');
      return;
    }
    try {
      haptics.triggerLight();
      const newRoutine = await createRoutine(db, newRoutineName.trim());
      setRoutinesList(prev => [newRoutine, ...prev]);
      setNewRoutineName('');
      setCreateRoutineModalVisible(false);
      
      await handleSelectRoutine(newRoutine);
      
      // Auto sync
      SyncService.syncSilently(db).catch(() => {});
      haptics.triggerSuccess();
      Alert.alert('Success', `Routine "${newRoutine.name}" created and set as active.`);
    } catch (err) {
      console.error('Error creating routine:', err);
      Alert.alert('Error', 'Failed to create routine.');
    }
  };

  const handleDeleteRoutine = async (routineId: string, routineName: string) => {
    if (routinesList.length <= 1) {
      Alert.alert('Error', 'You must have at least one routine.');
      return;
    }
    
    Alert.alert(
      'Delete Routine',
      `Are you sure you want to delete "${routineName}"? This will delete all its day plans and set logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              haptics.triggerLight();
              await deleteRoutine(db, routineId);
              
              const updatedList = routinesList.filter(r => r.id !== routineId);
              setRoutinesList(updatedList);
              
              if (selectedRoutine?.id === routineId) {
                const nextActive = updatedList[0];
                await handleSelectRoutine(nextActive);
              }
              
              // Auto sync
              SyncService.syncSilently(db).catch(() => {});
              haptics.triggerSuccess();
            } catch (err) {
              console.error('Error deleting routine:', err);
              Alert.alert('Error', 'Failed to delete routine.');
            }
          }
        }
      ]
    );
  };

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
          SyncService.deleteRemoteSetLog(set.id).catch(() => {});

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
          SyncService.syncSilently(db).catch(() => {});

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
        SyncService.syncSilently(db).catch(() => {});

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
        SyncService.deleteRemoteSetLog(set.id).catch(err => console.warn(err));
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
    SyncService.syncSilently(db).catch(() => {});
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
        <ActivityIndicator size="large" color={theme.text} />
      </ThemedView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {/* Routine Selector Header */}
          <View style={styles.routineHeader}>
            <Text style={[styles.screenTitle, { color: theme.text }]}>Today's Workout</Text>
            <Pressable onPress={() => setRoutineModalVisible(true)} style={styles.routineSelectorBtnInline}>
              <Text style={[styles.routineSelectorText, { color: theme.brandAccent }]}>
                {selectedRoutine?.name || 'Loading Routine...'}
              </Text>
              <ChevronDownIcon size={14} color={theme.brandAccent} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

          {/* Days of Week Row */}
          <View style={styles.daySelectorRow}>
            {DAYS_OF_WEEK.map((dayName, idx) => {
              const isActive = selectedDayIndex === idx;
              return (
                <Pressable
                  key={dayName}
                  onPress={() => {
                    setCustomPlanDayIndex(null);
                    setSelectedDayIndex(idx);
                  }}
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
            
            {/* Custom Plan Banner */}
            {customPlanDayIndex !== null && (
              <View style={[styles.swapBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '33' }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.swapBannerTitle, { color: theme.text }]}>
                    Alternative Workout Plan
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Currently logging {DAYS_FULL_NAME[customPlanDayIndex]}'s plan for {DAYS_FULL_NAME[selectedDayIndex]}.
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    haptics.triggerLight();
                    setCustomPlanDayIndex(null);
                  }}
                  style={styles.swapBannerResetBtn}>
                  <Text style={[styles.swapBannerResetBtnText, { color: theme.brandAccent }]}>Reset</Text>
                </Pressable>
              </View>
            )}

            {dayPlan?.isRest ? (
              <View style={styles.restDayContainer}>
                <Text style={[styles.restDayText, { color: theme.text }]}>
                  Today is a Rest Day 🧘
                </Text>
                <Text style={[styles.restDaySubtext, { color: theme.textSecondary }]}>
                  Take it easy and recover, or select another day above to log logs.
                </Text>
                <Pressable
                  onPress={() => {
                    haptics.triggerLight();
                    setSwapModalVisible(true);
                  }}
                  style={[styles.swapOptionButton, { backgroundColor: theme.textSecondary + '1a', borderColor: theme.textSecondary + '33' }]}>
                  <Text style={[styles.swapOptionButtonText, { color: theme.text }]}>
                    🔄 Do a Missed Workout Instead
                  </Text>
                </Pressable>
              </View>
            ) : exercises.length === 0 ? (
              <View style={styles.restDayContainer}>
                <Text style={[styles.restDayText, { color: theme.text }]}>
                  No routine scheduled for today.
                </Text>
                <Pressable
                  onPress={() => {
                    haptics.triggerLight();
                    setSwapModalVisible(true);
                  }}
                  style={[styles.swapOptionButton, { backgroundColor: theme.textSecondary + '1a', borderColor: theme.textSecondary + '33' }]}>
                  <Text style={[styles.swapOptionButtonText, { color: theme.text }]}>
                    🔄 Load Workout Plan
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Swap Option Button Inline */}
                {customPlanDayIndex === null && (
                  <View style={{ alignItems: 'flex-end', paddingHorizontal: Spacing.one }}>
                    <Pressable
                      onPress={() => {
                        haptics.triggerLight();
                        setSwapModalVisible(true);
                      }}
                      style={styles.inlineSwapBtn}>
                      <Text style={[styles.inlineSwapBtnText, { color: theme.textSecondary }]}>
                        🔄 Swap Plan / Do Missed Day
                      </Text>
                    </Pressable>
                  </View>
                )}

                {exercises.map((ex, exIdx) => {
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
                        {ex.isOpen ? (
                          <ChevronDownIcon size={16} color={theme.text} style={{ transform: [{ rotate: '180deg' }] }} />
                        ) : (
                          <ChevronDownIcon size={16} color={theme.text} />
                        )}
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
                                <TrashIcon
                                  size={18}
                                  color="#ef4444"
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
                                  style={[
                                    styles.typeBadge,
                                    badgeStyle,
                                    set.setType === 'work' && { backgroundColor: theme.brandAccent }
                                  ]}>
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
                                      {set.isLogged ? (
                                        <CheckmarkCircleFillIcon size={22} color="#10b981" />
                                      ) : (
                                        <CircleOutlineIcon size={22} color={theme.textSecondary} />
                                      )}
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
                })}
              </>
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

      {/* Swap Workout Plan Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={swapModalVisible}
        onRequestClose={() => setSwapModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Load Missed/Alternate Day Plan</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: Spacing.two }}>
              Select a day's plan to load for your current session on {DAYS_FULL_NAME[selectedDayIndex]}.
            </Text>
            
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: Spacing.two }}>
                {DAYS_FULL_NAME.map((dayName, idx) => {
                  const matchingPlan = allDayPlans.find(p => p.dayIndex === idx);
                  const isCurrent = idx === selectedDayIndex;
                  const isRest = matchingPlan ? matchingPlan.isRest : true;
                  
                  // Construct a summary of exercises for this day
                  let planDesc = 'Rest Day';
                  if (matchingPlan && !matchingPlan.isRest && matchingPlan.exercisePlans.length > 0) {
                    planDesc = matchingPlan.exercisePlans.map(ex => ex.name).join(', ');
                    if (planDesc.length > 40) {
                      planDesc = planDesc.substring(0, 37) + '...';
                    }
                  } else if (matchingPlan && !matchingPlan.isRest) {
                    planDesc = 'Empty training plan';
                  }

                  return (
                    <Pressable
                      key={dayName}
                      disabled={isCurrent}
                      onPress={() => {
                        haptics.triggerLight();
                        setCustomPlanDayIndex(idx);
                        setSwapModalVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.swapItemRow,
                        { borderColor: theme.textSecondary + '22', backgroundColor: pressed ? theme.textSecondary + '11' : 'transparent' },
                        isCurrent && { opacity: 0.4 }
                      ]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.swapItemName, { color: theme.text }, isCurrent && { color: theme.textSecondary }]}>
                          {dayName} {isCurrent && '(Current)'}
                        </Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={1}>
                          {planDesc}
                        </Text>
                      </View>
                      {!isRest && (
                        <View style={[styles.swapItemBadge, { backgroundColor: theme.brandAccent }]}>
                          <Text style={styles.swapItemBadgeText}>Active</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setSwapModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.textSecondary + '22' }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Routine Selector Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={routineModalVisible}
        onRequestClose={() => setRoutineModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Routine</Text>
            
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingVertical: Spacing.one }}>
              {routinesList.map((r) => {
                const isSelected = selectedRoutine?.id === r.id;
                return (
                  <View
                    key={r.id}
                    style={[
                      styles.routineListItem,
                      { backgroundColor: isSelected ? theme.backgroundSelected : 'transparent', borderColor: theme.textSecondary + '1a' }
                    ]}>
                    <Pressable
                      style={{ flex: 1, paddingVertical: Spacing.three }}
                      onPress={() => handleSelectRoutine(r)}>
                      <Text
                        style={[
                          styles.routineListItemText,
                          { color: theme.text },
                          isSelected && { color: theme.brandAccent, fontWeight: 'bold' }
                        ]}>
                        {r.name}
                      </Text>
                    </Pressable>
                    {routinesList.length > 1 && (
                      <Pressable
                        onPress={() => handleDeleteRoutine(r.id, r.name)}
                        style={styles.routineDeleteBtn}>
                        <TrashIcon size={14} color="#ef4444" />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => setCreateRoutineModalVisible(true)}
              style={[styles.createRoutineBtn, { borderColor: theme.brandAccent }]}>
              <Text style={[styles.createRoutineBtnText, { color: theme.brandAccent }]}>
                + Create New Routine
              </Text>
            </Pressable>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setRoutineModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.textSecondary + '22' }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Routine Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={createRoutineModalVisible}
        onRequestClose={() => setCreateRoutineModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Routine</Text>
            
            <View style={styles.modalInputsGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>ROUTINE NAME</Text>
              <TextInput
                value={newRoutineName}
                onChangeText={setNewRoutineName}
                placeholder="e.g. 4-Day Upper/Lower"
                placeholderTextColor={theme.textSecondary + '55'}
                style={[styles.modalInput, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setCreateRoutineModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.textSecondary + '22' }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleCreateRoutine}
                style={[styles.modalBtn, { backgroundColor: theme.brandAccent }]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  routineHeader: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
    gap: Spacing.one,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  routineSelectorBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  routineSelectorText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  routineListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    justifyContent: 'space-between',
  },
  routineListItemText: {
    fontSize: 14,
  },
  routineDeleteBtn: {
    padding: Spacing.two,
  },
  createRoutineBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  createRoutineBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
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
    paddingVertical: Spacing.two,
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
  swapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  swapBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  swapBannerResetBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  swapBannerResetBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  swapOptionButton: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.three,
  },
  swapOptionButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  inlineSwapBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.one,
  },
  inlineSwapBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  swapItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  swapItemName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  swapItemBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  swapItemBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.six,
  },
  modalContent: {
    borderRadius: Spacing.four,
    padding: Spacing.five,
    gap: Spacing.four,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  modalBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalInputsGroup: {
    gap: Spacing.three,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
});
