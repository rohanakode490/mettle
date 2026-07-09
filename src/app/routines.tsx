import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { TrashIcon, DragIcon, ChevronDownIcon } from '@/components/svg-icons';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView, TouchableOpacity } from 'react-native-gesture-handler';
import { safeStorage } from '@/utils/storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/useHaptics';
import { getRoutines, getDayPlans, insertDayPlan, createRoutine, deleteRoutine } from '@/db/queries';
import { SyncService } from '@/supabase/syncService';
import { Routine, DayPlan } from '@/types/database';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function RoutinesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const haptics = useHaptics();

  const [loading, setLoading] = useState(true);
  const [routinesList, setRoutinesList] = useState<Routine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  
  const [dayPlansList, setDayPlansList] = useState<DayPlan[]>([]);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  
  // Modal state to add/edit exercise plan
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState('3');
  const [newExReps, setNewExReps] = useState('8-12');
  const [newExSupersetId, setNewExSupersetId] = useState('');

  // Routine Switcher / Modal state
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [createRoutineModalVisible, setCreateRoutineModalVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');

  const ACTIVE_ROUTINE_KEY = '@active_routine_id';
  
  // Load routine details
  const loadRoutinesData = useCallback(async () => {
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
        
        const plans = await getDayPlans(db, activeRoutine.id);
        setDayPlansList(plans);
      }
    } catch (err) {
      console.error('Error loading routines:', err);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadRoutinesData();
  }, [loadRoutinesData]);

  const handleSelectRoutine = async (routine: Routine) => {
    try {
      haptics.triggerLight();
      await safeStorage.setItem(ACTIVE_ROUTINE_KEY, routine.id);
      setSelectedRoutine(routine);
      const plans = await getDayPlans(db, routine.id);
      setDayPlansList(plans);
      setRoutineModalVisible(false);
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
      
      // Select the new routine automatically
      await safeStorage.setItem(ACTIVE_ROUTINE_KEY, newRoutine.id);
      setSelectedRoutine(newRoutine);
      const plans = await getDayPlans(db, newRoutine.id);
      setDayPlansList(plans);
      setRoutineModalVisible(false);
      
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
              
              // Remove from list
              setRoutinesList(prev => prev.filter(r => r.id !== routineId));
              
              // If we deleted the currently selected routine, select a different one
              if (selectedRoutine?.id === routineId) {
                const remaining = routinesList.filter(r => r.id !== routineId);
                const nextActive = remaining[0];
                await safeStorage.setItem(ACTIVE_ROUTINE_KEY, nextActive.id);
                setSelectedRoutine(nextActive);
                const plans = await getDayPlans(db, nextActive.id);
                setDayPlansList(plans);
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

  const activeDayPlan = dayPlansList.find(p => p.dayIndex === selectedDayIdx) || null;

  // Toggle Day rest status
  const handleToggleRestDay = async () => {
    if (!selectedRoutine || !activeDayPlan) return;
    haptics.triggerLight();

    const updatedPlan: DayPlan = {
      ...activeDayPlan,
      isRest: !activeDayPlan.isRest,
    };

    try {
      // Update rest day in SQLite
      await db.runAsync(
        'UPDATE day_plans SET is_rest = ? WHERE id = ?',
        [updatedPlan.isRest ? 1 : 0, updatedPlan.id]
      );
      
      // Reload plans state
      setDayPlansList(prev => prev.map(p => (p.id === updatedPlan.id ? updatedPlan : p)));
      
      // Auto sync
      SyncService.syncSilently(db).catch(() => {});
    } catch (err) {
      console.error('Error updating rest day:', err);
    }
  };

  // Add exercise plan to selected day
  const handleAddExercise = async () => {
    if (!selectedRoutine || !activeDayPlan || !newExName.trim()) return;
    haptics.triggerLight();

    const newEx = {
      id: `ex-plan-${Math.random().toString(36).substr(2, 9)}`,
      name: newExName.trim(),
      targetSets: newExSets,
      targetReps: newExReps,
      supersetId: newExSupersetId.trim() || undefined,
    };

    const updatedPlan: DayPlan = {
      ...activeDayPlan,
      exercisePlans: [...activeDayPlan.exercisePlans, newEx],
    };

    try {
      await db.runAsync(
        'UPDATE day_plans SET exercise_plans = ? WHERE id = ?',
        [JSON.stringify(updatedPlan.exercisePlans), updatedPlan.id]
      );

      // Reload
      setDayPlansList(prev => prev.map(p => (p.id === updatedPlan.id ? updatedPlan : p)));
      setNewExName('');
      setNewExSets('3');
      setNewExReps('8-12');
      setNewExSupersetId('');
      setEditModalVisible(false);
      
      // Auto sync
      SyncService.syncSilently(db).catch(() => {});
    } catch (err) {
      console.error('Error adding exercise:', err);
    }
  };

  // Delete exercise plan
  const handleDeleteExercisePlan = async (exId: string) => {
    if (!activeDayPlan) return;
    haptics.triggerLight();

    const updatedPlan: DayPlan = {
      ...activeDayPlan,
      exercisePlans: activeDayPlan.exercisePlans.filter(ex => ex.id !== exId),
    };

    try {
      await db.runAsync(
        'UPDATE day_plans SET exercise_plans = ? WHERE id = ?',
        [JSON.stringify(updatedPlan.exercisePlans), updatedPlan.id]
      );

      setDayPlansList(prev => prev.map(p => (p.id === updatedPlan.id ? updatedPlan : p)));
      
      // Auto sync
      SyncService.syncSilently(db).catch(() => {});
    } catch (err) {
      console.error('Error deleting exercise plan:', err);
    }
  };

  // Handle drag-and-drop end to persist reordering to DB
  const handleDragEnd = async (newData: any[]) => {
    if (!activeDayPlan) return;
    haptics.triggerLight();

    const updatedPlan: DayPlan = {
      ...activeDayPlan,
      exercisePlans: newData,
    };

    try {
      await db.runAsync(
        'UPDATE day_plans SET exercise_plans = ? WHERE id = ?',
        [JSON.stringify(updatedPlan.exercisePlans), updatedPlan.id]
      );
      setDayPlansList(prev => prev.map(p => (p.id === updatedPlan.id ? updatedPlan : p)));
      
      // Auto sync
      SyncService.syncSilently(db).catch(() => {});
    } catch (err) {
      console.error('Error saving reordered exercises:', err);
    }
  };

  // Render individual exercise items for the draggable list
  const renderExerciseItem = ({ item, drag, isActive }: any) => {
    const isSuperset = !!item.supersetId;
    return (
      <ScaleDecorator>
        <View
          style={[
            styles.exerciseItemCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' },
            isSuperset && { borderColor: theme.textSecondary, borderWidth: 1 },
            isActive && { backgroundColor: theme.textSecondary + '22', opacity: 0.9 }
          ]}>
          
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={150}
            disabled={isActive}
            style={styles.dragHandleBtn}>
            <DragIcon size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={{ flex: 1, gap: 2, marginLeft: Spacing.two }}>
            {isSuperset && (
              <Text style={[styles.supersetTagText, { color: theme.textSecondary }]}>
                SUPERSET: {item.supersetId}
              </Text>
            )}
            <Text style={[styles.exerciseItemTitle, { color: theme.text }]}>
              {item.name}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              {item.targetSets} Sets × {item.targetReps} Reps
            </Text>
          </View>

          <View style={styles.actionButtonsCol}>
            <Pressable
              onPress={() => handleDeleteExercisePlan(item.id)}
              style={[styles.actionIconBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <TrashIcon
                size={14}
                color="#ef4444"
              />
            </Pressable>
          </View>
        </View>
      </ScaleDecorator>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          
          {/* Routines Title Area */}
          <ThemedView style={styles.header}>
            <ThemedText type="title">Routine Builder</ThemedText>
            <Pressable onPress={() => setRoutineModalVisible(true)} style={styles.routineSelectorRow}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                Active Routine: <Text style={{ color: theme.brandAccent, fontWeight: 'bold' }}>{selectedRoutine?.name}</Text>
              </Text>
              <ChevronDownIcon size={12} color={theme.brandAccent} style={{ marginLeft: 4 }} />
            </Pressable>
          </ThemedView>

          {/* Days of Week Horizontal Scroll */}
          <View style={styles.dayScrollWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelectorRow}>
              {DAYS_OF_WEEK.map((dayName, idx) => {
                const isActive = selectedDayIdx === idx;
                return (
                  <Pressable
                    key={dayName}
                    onPress={() => setSelectedDayIdx(idx)}
                    style={[
                      styles.dayButton,
                      { borderColor: theme.textSecondary + '22' },
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
            </ScrollView>
          </View>

          {/* Content Draggable exercises list */}
          {activeDayPlan && (
            <DraggableFlatList
              data={activeDayPlan.isRest ? [] : activeDayPlan.exercisePlans}
              onDragEnd={({ data }) => handleDragEnd(data)}
              keyExtractor={(item) => item.id}
              renderItem={renderExerciseItem}
              containerStyle={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              ListHeaderComponent={
                <View style={styles.planContainer}>
                  {/* Rest Day Switch */}
                  <View style={[styles.restDayCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.restDayTitle, { color: theme.text }]}>
                        Rest Day Status
                      </Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        {activeDayPlan.isRest ? 'This day is marked as a Rest Day.' : 'This day is active for training.'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleToggleRestDay}
                      style={[
                        styles.restDayToggleBtn,
                        { backgroundColor: activeDayPlan.isRest ? theme.brandAccent : theme.textSecondary + '22' }
                      ]}>
                      <Text style={styles.restDayToggleBtnText}>
                        {activeDayPlan.isRest ? 'Rest' : 'Active'}
                      </Text>
                    </Pressable>
                  </View>

                  {!activeDayPlan.isRest && (
                    <View style={styles.exerciseHeaderRow}>
                      <Text style={[styles.exerciseCountText, { color: theme.textSecondary }]}>
                        Planned Exercises ({activeDayPlan.exercisePlans.length})
                      </Text>
                      
                      <Pressable
                        onPress={() => setEditModalVisible(true)}
                        style={[styles.addExButtonInline, { backgroundColor: theme.textSecondary }]}>
                        <Text style={styles.addExButtonInlineText}>+ ADD</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              }
              ListEmptyComponent={
                !activeDayPlan.isRest ? (
                  <View style={styles.emptyExercisesCard}>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
                      No exercises planned. Tap "+ ADD" to build your workout day.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyExercisesCard}>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
                      Rest Day - Recovery and repair 🧘
                    </Text>
                  </View>
                )
              }
            />
          )}
        </SafeAreaView>

      {/* Add Exercise Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Exercise Plan</Text>
            
            <View style={styles.modalInputsGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EXERCISE NAME</Text>
              <TextInput
                value={newExName}
                onChangeText={setNewExName}
                placeholder="e.g. Incline Dumbbell Press"
                placeholderTextColor={theme.textSecondary + '55'}
                style={[styles.modalInput, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
              />

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

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SUPERSET GROUP ID (OPTIONAL)</Text>
              <TextInput
                value={newExSupersetId}
                onChangeText={setNewExSupersetId}
                placeholder="e.g. chest-superset"
                placeholderTextColor={theme.textSecondary + '55'}
                style={[styles.modalInput, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.textSecondary + '22' }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleAddExercise}
                style={[styles.modalBtn, { backgroundColor: theme.textSecondary }]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save Plan</Text>
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
  header: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
    gap: Spacing.one,
  },
  routineSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
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
  dayScrollWrapper: {
    marginTop: Spacing.three,
  },
  daySelectorRow: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  dayButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  planContainer: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  restDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  restDayTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  restDayToggleBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  restDayToggleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  exercisesWrapper: {
    gap: Spacing.three,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    marginBottom: Spacing.three,
  },
  exerciseCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  addExButtonInline: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  addExButtonInlineText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyExercisesCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  exerciseItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  supersetTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  exerciseItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButtonsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 2,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
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
  dragHandleBtn: {
    paddingVertical: Spacing.two,
    paddingRight: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
