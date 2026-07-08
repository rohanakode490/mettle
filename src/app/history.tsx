import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { CalendarIcon, TrashIcon, CloudIcon, UserIcon } from '@/components/svg-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/useHaptics';
import { getAllSetLogs, deleteSetLog } from '@/db/queries';
import { SetLog } from '@/types/database';
import { supabase } from '@/supabase/client';
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

  // Supabase sync and auth state
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

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
    loadHistory();
  }, [loadHistory]);

  // Handle Supabase auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in email and password.');
      return;
    }
    try {
      setAuthLoading(true);
      haptics.triggerLight();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      haptics.triggerSuccess();
      Alert.alert('Success', `Welcome back, ${data.user?.email}!`);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      Alert.alert('Authentication Failed', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in email and password.');
      return;
    }
    try {
      setAuthLoading(true);
      haptics.triggerLight();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      haptics.triggerSuccess();
      Alert.alert('Account Created', 'Account setup successful! Start syncing your workouts now.');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      Alert.alert('Sign Up Failed', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setAuthLoading(true);
      haptics.triggerLight();
      await supabase.auth.signOut();
      setUser(null);
      setSyncMessage('');
      haptics.triggerLight();
    } catch (err: any) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSyncData = async () => {
    try {
      setSyncLoading(true);
      setSyncMessage('Syncing local and remote databases...');
      haptics.triggerLight();
      
      const result = await SyncService.sync(db);
      
      if (result.success) {
        haptics.triggerSuccess();
        setSyncMessage(
          `Sync Successful!\n` +
          `Pushed: ${result.pushedRoutines} routines, ${result.pushedDayPlans} day plans, ${result.pushedSetLogs} set logs.\n` +
          `Pulled: ${result.pulledRoutines} routines, ${result.pulledDayPlans} day plans, ${result.pulledSetLogs} set logs.`
        );
        loadHistory();
      } else {
        haptics.triggerLight();
        setSyncMessage(`Sync Failed: ${result.message}`);
      }
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncLoading(false);
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
              
              <Pressable
                onPress={() => {
                  haptics.triggerLight();
                  setSyncModalVisible(true);
                }}
                style={({ pressed }) => [
                  styles.syncHeaderBtn,
                  { backgroundColor: theme.backgroundSelected, borderColor: theme.textSecondary + '33' },
                  pressed && { opacity: 0.7 }
                ]}>
                <CloudIcon size={20} color={user ? '#0d9488' : theme.text} />
                {user && <View style={styles.onlineIndicator} />}
              </Pressable>
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
                    {group.logs.map((log, logIdx) => {
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

                      const setTypeLabel = log.setType.toUpperCase();
                      const isLast = logIdx === group.logs.length - 1;

                      return (
                        <Swipeable
                          key={log.id}
                          renderRightActions={renderRightActions}
                          containerStyle={{ overflow: 'visible' }}>
                          <View style={[
                            styles.logRow,
                            !isLast && { borderBottomColor: theme.textSecondary + '0f', borderBottomWidth: 1 }
                          ]}>
                            <View style={styles.logLeft}>
                              <Text style={[styles.exerciseNameText, { color: theme.text }]}>
                                {log.exerciseName}
                              </Text>
                              <Text style={[styles.logTypeText, { color: theme.textSecondary }]}>
                                {setTypeLabel} SET
                              </Text>
                            </View>
                            <View style={styles.logRight}>
                              <Text style={[styles.logValueText, { color: theme.text }]}>
                                {log.weightKg} kg × {log.reps} reps
                              </Text>
                              <Text style={[styles.logTimeText, { color: theme.textSecondary }]}>
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      {/* Supabase Sync Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={syncModalVisible}
        onRequestClose={() => setSyncModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Cloud Synchronization</Text>
              <Pressable onPress={() => setSyncModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={{ color: theme.textSecondary, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>

            {user ? (
              // Authenticated User Panel
              <View style={styles.authPanel}>
                <View style={styles.userInfoRow}>
                  <UserIcon size={20} color={theme.text} />
                  <Text style={[styles.userEmailText, { color: theme.text }]}>
                    Logged in as: <Text style={{ fontWeight: 'bold' }}>{user.email}</Text>
                  </Text>
                </View>

                {syncLoading ? (
                  <View style={styles.syncProgressContainer}>
                    <ActivityIndicator size="small" color="#0d9488" />
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{syncMessage}</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.three, marginVertical: Spacing.two }}>
                    {syncMessage ? (
                      <View style={[styles.messageBox, { backgroundColor: theme.backgroundSelected, borderColor: theme.textSecondary + '22' }]}>
                        <Text style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>{syncMessage}</Text>
                      </View>
                    ) : (
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        Keep your workout plans, routines, and set logs securely backed up in the cloud. Syncing merges local data with your remote account.
                      </Text>
                    )}

                    <Pressable
                      onPress={handleSyncData}
                      style={[styles.syncActionBtn, { backgroundColor: '#0d9488' }]}>
                      <Text style={styles.syncActionBtnText}>🔄 Sync Data Now</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable
                  disabled={authLoading}
                  onPress={handleSignOut}
                  style={[styles.signOutBtn, { borderColor: '#ef4444' }]}>
                  {authLoading ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>Sign Out</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              // Auth Forms (Sign In / Sign Up)
              <View style={styles.authForm}>
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: Spacing.two }}>
                  Log in or create a free account to back up and sync your workout data across devices.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EMAIL ADDRESS</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="user@example.com"
                    placeholderTextColor={theme.textSecondary + '55'}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={[styles.formInput, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
                  />

                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>PASSWORD</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme.textSecondary + '55'}
                    secureTextEntry
                    autoCapitalize="none"
                    style={[styles.formInput, { color: theme.text, borderColor: theme.textSecondary + '33' }]}
                  />
                </View>

                <View style={styles.authButtonsRow}>
                  <Pressable
                    disabled={authLoading}
                    onPress={handleSignIn}
                    style={[styles.authFormBtn, { backgroundColor: theme.textSecondary }]}>
                    {authLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.authFormBtnText}>Sign In</Text>
                    )}
                  </Pressable>

                  <Pressable
                    disabled={authLoading}
                    onPress={handleSignUp}
                    style={[styles.authFormBtn, { backgroundColor: theme.backgroundSelected, borderWidth: 1, borderColor: theme.textSecondary + '33' }]}>
                    {authLoading ? (
                      <ActivityIndicator size="small" color={theme.text} />
                    ) : (
                      <Text style={[styles.authFormBtnText, { color: theme.text }]}>Sign Up</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );;
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
    marginBottom: Spacing.two,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.four,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0d9488',
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
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseBtn: {
    padding: Spacing.one,
  },
  authPanel: {
    gap: Spacing.four,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  userEmailText: {
    fontSize: 14,
  },
  syncProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginVertical: Spacing.two,
  },
  messageBox: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    padding: Spacing.three,
  },
  syncActionBtn: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  signOutBtn: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  authForm: {
    gap: Spacing.four,
  },
  inputGroup: {
    gap: Spacing.three,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  formInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  authButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  authFormBtn: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authFormBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
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
