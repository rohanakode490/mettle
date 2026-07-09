import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { UserIcon, SettingsIcon } from '@/components/svg-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/supabase/client';
import { SyncService } from '@/supabase/syncService';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const haptics = useHaptics();

  // Auth & Sync State
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Handle Supabase Auth observer
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Settings</ThemedText>
          <ThemedText themeColor="textSecondary">
            Configure your account and app preferences.
          </ThemedText>
        </ThemedView>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          
          {/* Cloud Sync & Auth Section */}
          <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
            <View style={styles.sectionHeaderRow}>
              <UserIcon size={20} color={theme.text} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Cloud Synchronization</Text>
            </View>

            {user ? (
              <View style={styles.authPanel}>
                <View style={styles.userInfoRow}>
                  <Text style={[styles.userEmailText, { color: theme.text }]}>
                    Logged in as: <Text style={{ fontWeight: 'bold' }}>{user.email}</Text>
                  </Text>
                </View>

                {syncLoading ? (
                  <View style={styles.syncProgressContainer}>
                    <ActivityIndicator size="small" color={theme.brandAccent} />
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
                      style={[styles.actionBtn, { backgroundColor: theme.brandAccent }]}>
                      <Text style={styles.actionBtnText}>🔄 Sync Data Now</Text>
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
              <View style={styles.authForm}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
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
                    style={[styles.formInput, { color: theme.text, borderColor: theme.textSecondary + '33', backgroundColor: theme.backgroundSelected }]}
                  />

                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>PASSWORD</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme.textSecondary + '55'}
                    secureTextEntry
                    autoCapitalize="none"
                    style={[styles.formInput, { color: theme.text, borderColor: theme.textSecondary + '33', backgroundColor: theme.backgroundSelected }]}
                  />
                </View>

                <View style={styles.authButtonsRow}>
                  <Pressable
                    disabled={authLoading}
                    onPress={handleSignIn}
                    style={[styles.actionBtn, { backgroundColor: theme.brandAccent, flex: 1 }]}>
                    {authLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionBtnText}>Sign In</Text>
                    )}
                  </Pressable>

                  <Pressable
                    disabled={authLoading}
                    onPress={handleSignUp}
                    style={[styles.actionBtn, { backgroundColor: theme.backgroundSelected, borderWidth: 1, borderColor: theme.textSecondary + '33', flex: 1 }]}>
                    {authLoading ? (
                      <ActivityIndicator size="small" color={theme.text} />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: theme.text }]}>Sign Up</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* About / Info Section */}
          <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
            <View style={styles.sectionHeaderRow}>
              <SettingsIcon size={20} color={theme.text} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>System Information</Text>
            </View>

            <View style={styles.infoGroup}>
              <View style={styles.infoRow}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>App Version</Text>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: 'bold' }}>1.0.0</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Database status</Text>
                <Text style={{ color: '#0d9488', fontSize: 13, fontWeight: 'bold' }}>Connected</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Engine version</Text>
                <Text style={{ color: theme.text, fontSize: 13 }}>Expo SDK 57 / SQLite</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
  sectionCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
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
  actionBtn: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
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
  infoGroup: {
    gap: Spacing.two,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
});
