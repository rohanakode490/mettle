import React, { useState, useCallback } from 'react';
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
import { ChevronDownIcon, TrashIcon, CheckmarkCircleFillIcon, CircleOutlineIcon, EditIcon, SyncIcon, SparklesIcon, RestIcon, LinkIcon, DumbbellIcon } from '@/components/svg-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { safeStorage } from '@/utils/storage';

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
  getExercises,
  addExerciseToDb,
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

function generateTempId(exPlanId: string, index: number) {
  return `temp-${exPlanId}-${index}-${Math.floor(Math.random() * 1000000000).toString(36)}`;
}

function generateExPlanId() {
  return `ex-plan-${Math.floor(Math.random() * 1000000000).toString(36)}`;
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

  // Modal & autocomplete state for adding/editing exercises on the go
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState('3');
  const [newExReps, setNewExReps] = useState('8-12');
  const [dbExercises, setDbExercises] = useState<string[]>([]);
  const [editingExId, setEditingExId] = useState<string | null>(null);
  const [newExSupersetTargetId, setNewExSupersetTargetId] = useState<string>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSupersetDropdown, setShowSupersetDropdown] = useState(false);

  const filteredDbExercises = (dbExercises || []).filter(ex =>
    searchQuery.trim() === '' || ex.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      const exList = await getExercises(db);
      setDbExercises(exList || []);
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
                id: generateTempId(exPlan.id, i),
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

  // Helper to link / unlink supersets automatically
  const applySupersetLinking = (
    exercisePlans: any[],
    currentExId: string,
    targetExId: string, // ID of sibling exercise or 'none'
    oldSupersetId?: string
  ) => {
    let plans = exercisePlans.map(ex => ({ ...ex }));
    const currentEx = plans.find(ex => ex.id === currentExId);
    if (!currentEx) return plans;

    if (targetExId === 'none') {
      currentEx.supersetId = undefined;
    } else {
      const targetEx = plans.find(ex => ex.id === targetExId);
      if (targetEx) {
        if (targetEx.supersetId) {
          currentEx.supersetId = targetEx.supersetId;
        } else {
          const newSupersetId = `ss-${Math.random().toString(36).substr(2, 9)}`;
          targetEx.supersetId = newSupersetId;
          currentEx.supersetId = newSupersetId;
        }
      }
    }

    if (oldSupersetId) {
      const sharingOld = plans.filter(ex => ex.supersetId === oldSupersetId);
      if (sharingOld.length <= 1) {
        for (const ex of plans) {
          if (ex.supersetId === oldSupersetId) {
            ex.supersetId = undefined;
          }
        }
      }
    }

    // Double check counts to avoid lone superset IDs
    const allSupersetIds = plans.map(ex => ex.supersetId).filter(Boolean) as string[];
    const counts = allSupersetIds.reduce((acc: any, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});

    for (const ex of plans) {
      if (ex.supersetId && counts[ex.supersetId] <= 1) {
        ex.supersetId = undefined;
      }
    }

    return plans;
  };

  const getSupersetLabel = (item: any) => {
    if (!item.supersetId) return '';
    const siblings = exercises.filter(ex => ex.id !== item.id && ex.supersetId === item.supersetId);
    if (siblings.length === 0) return '';
    return `Superset with ${siblings.map(s => s.name).join(', ')}`;
  };

  // Suggestion handlers removed since we now use bottom drawer list

  // Open modal for adding on the go
  const openAddModal = () => {
    setEditingExId(null);
    setNewExName('');
    setSearchQuery('');
    setNewExSets('3');
    setNewExReps('8-12');
    setNewExSupersetTargetId('none');
    setShowSupersetDropdown(false);
    setEditModalVisible(true);
  };

  // Open modal for editing on the go
  const openEditModal = (ex: any) => {
    setEditingExId(ex.id);
    setNewExName(ex.name);
    setSearchQuery(ex.name);
    setNewExSets(String(ex.targetSets));
    setNewExReps(ex.targetReps);
    
    // Find sibling in superset
    const sibling = dayPlan?.exercisePlans.find(
      e => e.id !== ex.id && e.supersetId === ex.supersetId
    );
    setNewExSupersetTargetId(sibling ? sibling.id : 'none');
    setShowSupersetDropdown(false);
    setEditModalVisible(true);
  };

  // Save (add/edit) exercise on the go
  const handleSaveExerciseOnTheGo = async () => {
    const finalName = (newExName || searchQuery).trim();
    if (!selectedRoutine || !finalName) return;
    haptics.triggerLight();

    const nameTrimmed = finalName;

    // Auto-register new exercise names in DB
    const currentDbExercises = dbExercises || [];
    if (!currentDbExercises.some(ex => ex.toLowerCase() === nameTrimmed.toLowerCase())) {
      await addExerciseToDb(db, nameTrimmed);
      const updatedList = await getExercises(db);
      setDbExercises(updatedList || []);
    }

    // Resolve or create dayPlan if missing
    let targetDayPlan = dayPlan;
    if (!targetDayPlan) {
      // Find or create dayPlan for current dayIndex
      const targetDayIdx = customPlanDayIndex !== null ? customPlanDayIndex : selectedDayIndex;
      const dpId = `dp-${selectedRoutine.id}-${targetDayIdx}`;
      targetDayPlan = {
        id: dpId,
        routineId: selectedRoutine.id,
        dayIndex: targetDayIdx,
        isRest: false,
        exercisePlans: []
      };
      
      // Insert new dayPlan in SQLite
      await db.runAsync(
        'INSERT OR REPLACE INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
        [targetDayPlan.id, targetDayPlan.routineId, targetDayPlan.dayIndex, 0, '[]']
      );
    }

    let updatedPlans = [...targetDayPlan.exercisePlans];

    if (editingExId) {
      const oldEx = updatedPlans.find(ex => ex.id === editingExId);
      const oldSupersetId = oldEx?.supersetId;

      updatedPlans = updatedPlans.map(ex => {
        if (ex.id === editingExId) {
          return {
            ...ex,
            name: nameTrimmed,
            targetSets: newExSets,
            targetReps: newExReps,
          };
        }
        return ex;
      });

      updatedPlans = applySupersetLinking(updatedPlans, editingExId, newExSupersetTargetId, oldSupersetId);
    } else {
      const tempId = generateExPlanId();
      const newEx = {
        id: tempId,
        name: nameTrimmed,
        targetSets: newExSets,
        targetReps: newExReps,
        supersetId: undefined,
      };

      updatedPlans.push(newEx);
      updatedPlans = applySupersetLinking(updatedPlans, tempId, newExSupersetTargetId);
    }

    try {
      // Save to day_plans
      await db.runAsync(
        'UPDATE day_plans SET exercise_plans = ?, is_rest = ? WHERE id = ?',
        [JSON.stringify(updatedPlans), 0, targetDayPlan.id]
      );

      setNewExName('');
      setNewExSets('3');
      setNewExReps('8-12');
      setNewExSupersetTargetId('none');
      setEditingExId(null);
      setEditModalVisible(false);
      
      // Reload
      await loadWorkoutData();
      
      SyncService.syncSilently(db).catch(() => {});
    } catch (err) {
      console.error('Error saving exercise on the go:', err);
    }
  };

  // Delete exercise plan from today's workout on the go
  const handleDeleteExerciseOnTheGo = async (exId: string, exName: string) => {
    if (!dayPlan) return;
    haptics.triggerLight();

    Alert.alert(
      'Remove Exercise',
      `Are you sure you want to remove "${exName}" from today's workout? Any logged sets for it today will remain in history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            let updatedPlans = dayPlan.exercisePlans.filter(ex => ex.id !== exId);

            // Clean up remaining supersets: if only 1 exercise shares a supersetId, clear it
            const allSupersetIds = updatedPlans.map(ex => ex.supersetId).filter(Boolean) as string[];
            const counts = allSupersetIds.reduce((acc: any, id) => {
              acc[id] = (acc[id] || 0) + 1;
              return acc;
            }, {});

            updatedPlans = updatedPlans.map(ex => {
              if (ex.supersetId && counts[ex.supersetId] <= 1) {
                return { ...ex, supersetId: undefined };
              }
              return ex;
            });

            try {
              await db.runAsync(
                'UPDATE day_plans SET exercise_plans = ? WHERE id = ?',
                [JSON.stringify(updatedPlans), dayPlan.id]
              );
              
              // Reload
              await loadWorkoutData();
              SyncService.syncSilently(db).catch(() => {});
            } catch (err) {
              console.error('Error deleting exercise plan:', err);
            }
          }
        }
      ]
    );
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
            <Text style={[styles.screenTitle, { color: theme.text }]}>{"Today's Workout"}</Text>
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
                    {"Currently logging " + DAYS_FULL_NAME[customPlanDayIndex] + "'s plan for " + DAYS_FULL_NAME[selectedDayIndex] + "."}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.one }}>
                  <RestIcon size={20} color={theme.brandAccent} />
                  <Text style={[styles.restDayText, { color: theme.text, marginBottom: 0 }]}>
                    Today is a Rest Day
                  </Text>
                </View>
                <Text style={[styles.restDaySubtext, { color: theme.textSecondary }]}>
                  Take it easy and recover, or select another day above to load logs.
                </Text>
                <Pressable
                  onPress={() => {
                    haptics.triggerLight();
                    setSwapModalVisible(true);
                  }}
                  style={[styles.swapOptionButton, { backgroundColor: theme.brandAccent + '15', borderColor: theme.brandAccent + '33' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two }}>
                    <SyncIcon size={16} color={theme.text} />
                    <Text style={[styles.swapOptionButtonText, { color: theme.text }]}>
                      Do a Missed Workout Instead
                    </Text>
                  </View>
                </Pressable>
                
                <Pressable
                  onPress={openAddModal}
                  style={[styles.swapOptionButton, { backgroundColor: theme.brandAccent, borderColor: theme.brandAccent, marginTop: Spacing.two }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two }}>
                    <DumbbellIcon size={16} color="#000" />
                    <Text style={[styles.swapOptionButtonText, { color: '#000', fontWeight: 'bold' }]}>
                      Add Exercise / Start Workout
                    </Text>
                  </View>
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
                  style={[styles.swapOptionButton, { backgroundColor: theme.brandAccent + '15', borderColor: theme.brandAccent + '33' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two }}>
                    <SyncIcon size={16} color={theme.text} />
                    <Text style={[styles.swapOptionButtonText, { color: theme.text }]}>
                      Load Workout Plan
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={openAddModal}
                  style={[styles.swapOptionButton, { backgroundColor: theme.brandAccent, borderColor: theme.brandAccent, marginTop: Spacing.two }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two }}>
                    <DumbbellIcon size={16} color="#000" />
                    <Text style={[styles.swapOptionButtonText, { color: '#000', fontWeight: 'bold' }]}>
                      Build Workout / Add Exercise
                    </Text>
                  </View>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <SyncIcon size={12} color={theme.textSecondary} />
                        <Text style={[styles.inlineSwapBtnText, { color: theme.textSecondary }]}>
                          Swap Plan / Do Missed Day
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                )}

                {exercises.map((ex, exIdx) => {
                  const sLabel = getSupersetLabel(ex);
                  const isSuperset = !!sLabel;
                  
                  return (
                    <Animated.View
                      entering={FadeIn}
                      layout={Layout.springify()}
                      key={ex.id}
                      style={[
                        styles.exerciseCard,
                        { borderColor: theme.textSecondary + '1a', backgroundColor: theme.backgroundElement },
                        isSuperset && { borderColor: theme.brandAccent, borderWidth: 1.5 }
                      ]}>
                      {/* Accordion Heading */}
                      <View style={styles.cardHeaderContainer}>
                        <Pressable
                          style={styles.cardHeaderMain}
                          onPress={() => toggleAccordion(exIdx)}>
                          <View style={{ flex: 1 }}>
                            {isSuperset && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.one }}>
                                <LinkIcon size={12} color={theme.brandAccent} />
                                <Text style={[styles.supersetTag, { color: theme.brandAccent, fontWeight: '600', marginBottom: 0 }]}>
                                  {sLabel}
                                </Text>
                              </View>
                            )}
                            <Text style={[styles.exerciseTitle, { color: theme.text }]}>
                              {ex.name}
                            </Text>
                            <Text style={[styles.exerciseSubtitle, { color: theme.textSecondary }]}>
                              Target: {ex.targetSets} sets × {ex.targetReps} reps
                            </Text>
                          </View>
                        </Pressable>

                        <View style={styles.cardHeaderActions}>
                          <Pressable
                            onPress={() => openEditModal(ex)}
                            style={styles.cardActionBtn}>
                            <EditIcon size={14} color={theme.textSecondary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteExerciseOnTheGo(ex.id, ex.name)}
                            style={styles.cardActionBtn}>
                            <TrashIcon size={14} color="#ef4444" />
                          </Pressable>
                          <Pressable
                            onPress={() => toggleAccordion(exIdx)}
                            style={styles.cardChevronBtn}>
                            {ex.isOpen ? (
                              <ChevronDownIcon size={16} color={theme.text} style={{ transform: [{ rotate: '180deg' }] }} />
                            ) : (
                              <ChevronDownIcon size={16} color={theme.text} />
                            )}
                          </Pressable>
                        </View>
                      </View>

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
                                testID={`delete-set-${exIdx}-${setIdx}`}
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
                              let text = 'S';
                              let badgeStyle = styles.badgeWork;
                              if (set.setType === 'warmup') {
                                text = 'W';
                                badgeStyle = styles.badgeWarmup;
                              } else if (set.setType === 'dropset') {
                                text = 'D';
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
              <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
                <Pressable
                  onPress={openAddModal}
                  style={[styles.addExerciseOnTheGoBtn, { borderColor: theme.brandAccent }]}>
                  <Text style={[styles.addExerciseOnTheGoBtnText, { color: theme.brandAccent }]}>
                    + ADD EXERCISE ON THE GO
                  </Text>
                </Pressable>
                
                <Pressable
                  onPress={handleCompleteWorkout}
                  style={[styles.completeWorkoutButton, { backgroundColor: theme.brandAccent }]}>
                  <Text style={styles.completeWorkoutButtonText}>
                    COMPLETE WORKOUT
                  </Text>
                </Pressable>
              </View>
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
              {"Select a day's plan to load for your current session on " + DAYS_FULL_NAME[selectedDayIndex] + "."}
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
                style={[styles.modalBtn, { backgroundColor: theme.brandAccent + '1a' }]}>
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
                style={[styles.modalBtn, { backgroundColor: theme.brandAccent + '1a' }]}>
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
                style={[styles.modalInput, { color: theme.text, borderColor: theme.brandAccent + '33' }]}
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setCreateRoutineModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.brandAccent + '1a' }]}>
                <Text style={[styles.modalBtnText, { color: theme.brandAccent }]}>Cancel</Text>
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
      {/* Add / Edit Exercise Modal on the Go */}
      {/* Add / Edit Exercise Drawer on the Go */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.backgroundElement, borderTopWidth: 1, borderTopColor: theme.textSecondary + '22' }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={[styles.drawerHandle, { backgroundColor: theme.textSecondary + '33' }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingExId ? 'Edit Exercise Details' : 'Add Exercise on the Go'}
            </Text>
            
            <View style={styles.modalInputsGroup}>
              {/* Search and Select existing exercise */}
              <View style={{ marginBottom: Spacing.two }}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginBottom: 4 }]}>CHOOSE EXERCISE</Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    if (newExName && newExName !== text) {
                      setNewExName('');
                    }
                  }}
                  placeholder="Search existing or type custom name..."
                  placeholderTextColor={theme.textSecondary + '55'}
                  style={[styles.modalInput, { color: theme.text, borderColor: theme.textSecondary + '33', marginBottom: Spacing.two }]}
                />
                
                {/* Scrollable list of existing exercises */}
                <View style={{ height: 110, borderWidth: 1, borderColor: theme.textSecondary + '22', borderRadius: 8, overflow: 'hidden', backgroundColor: theme.background + '44' }}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {newExName ? (
                      <View style={{ padding: Spacing.two, backgroundColor: theme.brandAccent + '15', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: theme.brandAccent, fontWeight: 'bold', fontSize: 13 }}>Selected: {newExName}</Text>
                        <Pressable onPress={() => { setNewExName(''); setSearchQuery(''); }}>
                          <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: 'bold' }}>Clear</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {filteredDbExercises.map((exName) => (
                      <Pressable
                        key={exName}
                        onPress={() => {
                          setNewExName(exName);
                          setSearchQuery(exName);
                        }}
                        style={({ pressed }) => [
                          styles.suggestionItem,
                          { borderBottomColor: theme.textSecondary + '1a' },
                          newExName === exName && { backgroundColor: theme.brandAccent + '22' },
                          pressed && { backgroundColor: theme.textSecondary + '11' }
                        ]}>
                        <Text style={[styles.suggestionItemText, { color: theme.text, fontWeight: newExName === exName ? 'bold' : 'normal' }]}>
                          {exName} {newExName === exName ? '✓' : ''}
                        </Text>
                      </Pressable>
                    ))}

                    {searchQuery.trim() !== '' && !dbExercises.some(ex => ex.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                      <Pressable
                        onPress={() => {
                          setNewExName(searchQuery.trim());
                        }}
                        style={({ pressed }) => [
                          styles.suggestionItem,
                          { borderBottomColor: theme.textSecondary + '1a', backgroundColor: theme.brandAccentLight + '22' },
                          newExName === searchQuery.trim() && { backgroundColor: theme.brandAccent + '33' },
                          pressed && { backgroundColor: theme.textSecondary + '22' }
                        ]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <SparklesIcon size={14} color={theme.brandAccent} />
                          <Text style={[styles.suggestionItemText, { color: theme.brandAccent, fontWeight: 'bold' }]}>
                            {"Create custom: \"" + searchQuery.trim() + "\""}
                          </Text>
                        </View>
                      </Pressable>
                    )}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.inlineInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>PLANNED SETS</Text>
                  <TextInput
                    value={newExSets}
                    onChangeText={setNewExSets}
                    placeholder="3"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textSecondary + '55'}
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>TARGET REPS</Text>
                  <TextInput
                    value={newExReps}
                    onChangeText={setNewExReps}
                    placeholder="8-12"
                    placeholderTextColor={theme.textSecondary + '55'}
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
                  />
                </View>
              </View>

              {/* Superset Link Dropdown badging */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SUPERSET LINK (OPTIONAL)</Text>
              <View style={{ position: 'relative', zIndex: 999 }}>
                <Pressable
                  onPress={() => setShowSupersetDropdown(!showSupersetDropdown)}
                  style={({ pressed }) => [
                    styles.modalInput,
                    {
                      color: theme.text,
                      borderColor: theme.textSecondary + '33',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: theme.backgroundElement,
                    },
                    pressed && { opacity: 0.8 }
                  ]}>
                  <Text style={{ color: newExSupersetTargetId === 'none' ? theme.textSecondary + '88' : theme.text }}>
                    {newExSupersetTargetId === 'none' 
                      ? 'None (Single Exercise)' 
                      : (dayPlan?.exercisePlans.find(ex => ex.id === newExSupersetTargetId)?.name || 'Linked Exercise')}
                  </Text>
                  <ChevronDownIcon size={16} color={theme.textSecondary} />
                </Pressable>

                {showSupersetDropdown && (
                  <View style={{
                    position: 'absolute',
                    top: 45,
                    left: 0,
                    right: 0,
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.textSecondary + '33',
                    borderWidth: 1,
                    borderRadius: 8,
                    zIndex: 9999,
                    maxHeight: 150,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 5,
                  }}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                      <Pressable
                        onPress={() => {
                          setNewExSupersetTargetId('none');
                          setShowSupersetDropdown(false);
                        }}
                        style={({ pressed }) => [
                          styles.suggestionItem,
                          { borderBottomColor: theme.textSecondary + '1a' },
                          newExSupersetTargetId === 'none' && { backgroundColor: theme.brandAccent + '22' },
                          pressed && { backgroundColor: theme.textSecondary + '11' }
                        ]}>
                        <Text style={{ color: theme.text, fontWeight: newExSupersetTargetId === 'none' ? 'bold' : 'normal' }}>
                          None (Single Exercise)
                        </Text>
                      </Pressable>
                      {dayPlan?.exercisePlans.filter(ex => ex.id !== editingExId).map(ex => (
                        <Pressable
                          key={ex.id}
                          onPress={() => {
                            setNewExSupersetTargetId(ex.id);
                            setShowSupersetDropdown(false);
                          }}
                          style={({ pressed }) => [
                            styles.suggestionItem,
                            { borderBottomColor: theme.textSecondary + '1a' },
                            newExSupersetTargetId === ex.id && { backgroundColor: theme.brandAccent + '22' },
                            pressed && { backgroundColor: theme.textSecondary + '11' }
                          ]}>
                          <Text style={{ color: theme.text, fontWeight: newExSupersetTargetId === ex.id ? 'bold' : 'normal' }}>
                            Link with {ex.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.modalButtonsRow, { marginTop: Spacing.four }]}>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.brandAccent + '1a' }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleSaveExerciseOnTheGo}
                style={[styles.modalBtn, { backgroundColor: theme.brandAccent }]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {editingExId ? 'Save Changes' : 'Save Plan'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
    backgroundColor: '#6366f1', // Indigo 500
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    paddingBottom: Platform.OS === 'ios' ? Spacing.six : Spacing.five,
    gap: Spacing.three,
    minHeight: '60%',
    maxHeight: '95%',
  },
  drawerHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: Spacing.two,
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
  inlineInputsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    zIndex: 9999,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionItem: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },
  suggestionItemText: {
    fontSize: 14,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
  },
  supersetChoiceBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supersetChoiceText: {
    fontSize: 12,
  },
  cardHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: Spacing.three,
  },
  cardHeaderMain: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardActionBtn: {
    padding: Spacing.two,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  cardChevronBtn: {
    padding: Spacing.two,
  },
  addExerciseOnTheGoBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  addExerciseOnTheGoBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
