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
import { ChevronDownIcon, TrashIcon } from '@/components/svg-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/useHaptics';
import { getRoutines, getDayPlans, insertDayPlan } from '@/db/queries';
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
  
  // Load routine details
  const loadRoutinesData = useCallback(async () => {
    try {
      setLoading(true);
      const routines = await getRoutines(db);
      setRoutinesList(routines);
      
      if (routines.length > 0) {
        const activeRoutine = routines[0];
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
    } catch (err) {
      console.error('Error deleting exercise plan:', err);
    }
  };

  // Shift exercise position (Reordering)
  const handleMoveExercise = async (index: number, direction: 'up' | 'down') => {
    if (!activeDayPlan) return;
    const list = [...activeDayPlan.exercisePlans];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIdx < 0 || targetIdx >= list.length) return;

    haptics.triggerLight();
    // Swap items
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updatedPlan: DayPlan = {
      ...activeDayPlan,
      exercisePlans: list,
    };

    try {
      await db.runAsync(
        'UPDATE day_plans SET exercise_plans = ? WHERE id = ?',
        [JSON.stringify(updatedPlan.exercisePlans), updatedPlan.id]
      );

      setDayPlansList(prev => prev.map(p => (p.id === updatedPlan.id ? updatedPlan : p)));
    } catch (err) {
      console.error('Error reordering exercises:', err);
    }
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
        
        {/* Routines Title Area */}
        <ThemedView style={styles.header}>
          <ThemedText type="title">Routine Builder</ThemedText>
          <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
            Active Routine: <Text style={{ color: theme.text, fontWeight: 'bold' }}>{selectedRoutine?.name}</Text>
          </Text>
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

        {/* Content Section */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activeDayPlan && (
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
                    { backgroundColor: activeDayPlan.isRest ? '#0d9488' : theme.textSecondary + '22' }
                  ]}>
                  <Text style={styles.restDayToggleBtnText}>
                    {activeDayPlan.isRest ? 'Rest' : 'Active'}
                  </Text>
                </Pressable>
              </View>

              {!activeDayPlan.isRest && (
                <View style={styles.exercisesWrapper}>
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

                  {activeDayPlan.exercisePlans.length === 0 ? (
                    <View style={styles.emptyExercisesCard}>
                      <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>
                        No exercises planned. Tap "+ ADD" to build your workout day.
                      </Text>
                    </View>
                  ) : (
                    activeDayPlan.exercisePlans.map((ex, exIdx) => {
                      const isSuperset = !!ex.supersetId;
                      
                      return (
                        <View
                          key={ex.id}
                          style={[
                            styles.exerciseItemCard,
                            { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' },
                            isSuperset && { borderColor: theme.textSecondary, borderWidth: 1 }
                          ]}>
                          <View style={{ flex: 1, gap: 2 }}>
                            {isSuperset && (
                              <Text style={[styles.supersetTagText, { color: theme.textSecondary }]}>
                                SUPERSET: {ex.supersetId}
                              </Text>
                            )}
                            <Text style={[styles.exerciseItemTitle, { color: theme.text }]}>
                              {ex.name}
                            </Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                              {ex.targetSets} Sets × {ex.targetReps} Reps
                            </Text>
                          </View>

                          {/* Reordering & Control Actions */}
                          <View style={styles.actionButtonsCol}>
                            <View style={styles.reorderRow}>
                              <Pressable
                                disabled={exIdx === 0}
                                onPress={() => handleMoveExercise(exIdx, 'up')}
                                style={styles.actionIconBtn}>
                                <ChevronDownIcon
                                  size={16}
                                  color={exIdx === 0 ? theme.textSecondary + '33' : theme.text}
                                  style={{ transform: [{ rotate: '180deg' }] }}
                                />
                              </Pressable>
                              <Pressable
                                disabled={exIdx === activeDayPlan.exercisePlans.length - 1}
                                onPress={() => handleMoveExercise(exIdx, 'down')}
                                style={styles.actionIconBtn}>
                                <ChevronDownIcon
                                  size={16}
                                  color={exIdx === activeDayPlan.exercisePlans.length - 1 ? theme.textSecondary + '33' : theme.text}
                                />
                              </Pressable>
                            </View>

                            <Pressable
                              onPress={() => handleDeleteExercisePlan(ex.id)}
                              style={[styles.actionIconBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                              <TrashIcon
                                size={14}
                                color="#ef4444"
                              />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
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
  },
  header: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
    gap: Spacing.one,
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
    gap: Spacing.four,
  },
  restDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
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
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
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
});
