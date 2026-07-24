import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { CalendarIcon, TrashIcon } from '@/components/svg-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/useHaptics';
import { getAllSetLogs, deleteSetLog } from '@/db/queries';
import { SetLog } from '@/types/database';
import { SyncService } from '@/supabase/syncService';

interface GroupedLogs {
  dateString: string;
  logs: SetLog[];
}

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const haptics = useHaptics();

  const [loading, setLoading] = useState(true);
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs[]>([]);

  // Load history data
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const allLogs = await getAllSetLogs(db);

      // Group logs by Date (YYYY-MM-DD)
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
      // Delete from Supabase asynchronously if online
      SyncService.deleteRemoteSetLog(logId).catch(err => console.warn(err));
      loadHistory(); // Reload history logs
    } catch (err) {
      console.error('Error deleting set log:', err);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ThemedView style={styles.header}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="title">Workout History</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Swipe left on a set log row to delete it.
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {groupedLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <CalendarIcon
                  size={48}
                  color={theme.textSecondary + '44'}
                />
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
                          <TrashIcon
                            size={18}
                            color="#ef4444"
                          />
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
                                {log.weightKg} kg × {log.reps} reps
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
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.four,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  groupCard: {
    gap: Spacing.two,
  },
  groupDateHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: Spacing.one,
  },
  groupList: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    backgroundColor: 'transparent',
  },
  logLeft: {
    gap: 2,
    flex: 1,
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
    fontSize: 14,
    fontWeight: '600',
  },
  logTimeText: {
    fontSize: 10,
  },
  deleteButtonAction: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: '100%',
  },
});
