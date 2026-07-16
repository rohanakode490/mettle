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
import { UserIcon, SettingsIcon, ClipboardIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon } from '@/components/svg-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/supabase/client';
import { SyncService } from '@/supabase/syncService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportBackupData, importBackupData } from '@/db/queries';

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
  const [backupLoading, setBackupLoading] = useState(false);

  // Enhanced Auth UI/UX State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const getInitials = (emailStr: string) => {
    return emailStr ? emailStr.charAt(0).toUpperCase() : 'U';
  };


  const handleExportBackup = async () => {
    try {
      setBackupLoading(true);
      haptics.triggerLight();

      const backupJson = await exportBackupData(db);
      
      const filename = `mettle-backup-${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, backupJson, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Workout History Backup',
          UTI: 'public.json',
        });
        haptics.triggerSuccess();
      } else {
        Alert.alert('Error', 'Sharing is not available on this platform.');
      }
    } catch (err: any) {
      console.error('[Backup] Export error details:', err);
      Alert.alert('Export Failed', err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportBackup = async () => {
    Alert.alert(
      'Import Backup',
      'This will import routines, day plans, and set logs from the selected file. Existing items with the same IDs will be replaced. Are you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'default',
          onPress: async () => {
            try {
              setBackupLoading(true);
              haptics.triggerLight();

              const pickerResult = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
                return;
              }

              const selectedFile = pickerResult.assets[0];
              const fileContent = await FileSystem.readAsStringAsync(selectedFile.uri, {
                encoding: FileSystem.EncodingType.UTF8,
              });

              const result = await importBackupData(db, fileContent);
              
              haptics.triggerSuccess();
              Alert.alert(
                'Import Successful',
                `Successfully imported:\n- ${result.routinesImported} routines\n- ${result.dayPlansImported} day plans\n- ${result.setLogsImported} set logs.`
              );

              if (user) {
                SyncService.syncSilently(db).catch(() => {});
              }
            } catch (err: any) {
              console.error('[Backup] Import error details:', err);
              Alert.alert('Import Failed', `Invalid backup file or format.\nDetails: ${err.message}`);
            } finally {
              setBackupLoading(false);
            }
          },
        },
      ]
    );
  };

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

  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('Email is required.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      isValid = false;
    }

    if (!isValid) {
      haptics.triggerWarning();
    }
    return isValid;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;
    try {
      setAuthLoading(true);
      haptics.triggerLight();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      haptics.triggerSuccess();
      setEmail('');
      setPassword('');
    } catch (err: any) {
      haptics.triggerWarning();
      Alert.alert('Authentication Failed', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;
    try {
      setAuthLoading(true);
      haptics.triggerLight();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      haptics.triggerSuccess();
      Alert.alert('Account Created', 'Account setup successful! Start syncing your workouts now.');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      haptics.triggerWarning();
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
                <View style={[styles.profileCard, { backgroundColor: theme.backgroundSelected, borderColor: theme.textSecondary + '1a' }]}>
                  <View style={[styles.avatarContainer, { backgroundColor: theme.brandAccent }]}>
                    <Text style={styles.avatarText}>{getInitials(user.email ?? '')}</Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text numberOfLines={1} style={[styles.profileEmail, { color: theme.text }]}>{user.email}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.statusIndicator, { backgroundColor: '#10b981' }]} />
                      <Text style={[styles.statusText, { color: theme.textSecondary }]}>Cloud Sync Active</Text>
                    </View>
                  </View>
                </View>

                {syncLoading ? (
                  <View style={styles.syncProgressContainer}>
                    <ActivityIndicator size="small" color={theme.brandAccent} />
                    <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>{syncMessage}</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.three, marginVertical: Spacing.one }}>
                    {syncMessage ? (
                      <View style={[styles.messageBox, { backgroundColor: theme.backgroundSelected, borderColor: theme.textSecondary + '22' }]}>
                        <Text style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>{syncMessage}</Text>
                      </View>
                    ) : (
                      <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
                        Keep your workout routines, custom plans, and checklists securely backed up in the cloud. Syncing merges local progress with your cloud database.
                      </Text>
                    )}

                    <Pressable
                      onPress={handleSyncData}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: theme.brandAccent, opacity: pressed ? 0.8 : 1 }
                      ]}>
                      <Text style={styles.actionBtnText}>🔄 Sync Data Now</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable
                  disabled={authLoading}
                  onPress={handleSignOut}
                  style={({ pressed }) => [
                    styles.signOutBtn,
                    { borderColor: '#ef4444', opacity: pressed ? 0.8 : 1 }
                  ]}>
                  {authLoading ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>Sign Out</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.authForm}>
                <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: Spacing.one }}>
                  Access your workout routines and logs on any device. Sign in or register in seconds.
                </Text>

                {/* Segmented Control Toggle */}
                <View style={[styles.toggleContainer, { backgroundColor: theme.backgroundSelected }]}>
                  <Pressable
                    onPress={() => {
                      setAuthMode('signin');
                      haptics.triggerLight();
                      setEmailError('');
                      setPasswordError('');
                    }}
                    style={[
                      styles.toggleTab,
                      authMode === 'signin' && [styles.toggleTabActive, { backgroundColor: theme.backgroundElement }]
                    ]}>
                    <Text style={[
                      styles.toggleTabText,
                      { color: authMode === 'signin' ? theme.brandAccent : theme.textSecondary }
                    ]}>
                      Sign In
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAuthMode('signup');
                      haptics.triggerLight();
                      setEmailError('');
                      setPasswordError('');
                    }}
                    style={[
                      styles.toggleTab,
                      authMode === 'signup' && [styles.toggleTabActive, { backgroundColor: theme.backgroundElement }]
                    ]}>
                    <Text style={[
                      styles.toggleTabText,
                      { color: authMode === 'signup' ? theme.brandAccent : theme.textSecondary }
                    ]}>
                      Create Account
                    </Text>
                  </Pressable>
                </View>

                {/* Form Inputs */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EMAIL ADDRESS</Text>
                  <View style={[
                    styles.inputWrapper,
                    {
                      borderColor: emailError ? '#ef4444' : focusedInput === 'email' ? theme.brandAccent : theme.textSecondary + '33',
                      backgroundColor: theme.backgroundSelected
                    }
                  ]}>
                    <MailIcon size={18} color={emailError ? '#ef4444' : focusedInput === 'email' ? theme.brandAccent : theme.textSecondary + '88'} />
                    <TextInput
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        if (emailError) setEmailError('');
                      }}
                      placeholder="you@example.com"
                      placeholderTextColor={theme.textSecondary + '55'}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                      style={[styles.formInputNew, { color: theme.text }]}
                    />
                  </View>
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                  <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: Spacing.two }]}>PASSWORD</Text>
                  <View style={[
                    styles.inputWrapper,
                    {
                      borderColor: passwordError ? '#ef4444' : focusedInput === 'password' ? theme.brandAccent : theme.textSecondary + '33',
                      backgroundColor: theme.backgroundSelected
                    }
                  ]}>
                    <LockIcon size={18} color={passwordError ? '#ef4444' : focusedInput === 'password' ? theme.brandAccent : theme.textSecondary + '88'} />
                    <TextInput
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        if (passwordError) setPasswordError('');
                      }}
                      placeholder={authMode === 'signin' ? 'Enter password' : 'Min. 6 characters'}
                      placeholderTextColor={theme.textSecondary + '55'}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                      style={[styles.formInputNew, { color: theme.text }]}
                    />
                    <Pressable
                      onPress={() => {
                        setShowPassword(!showPassword);
                        haptics.triggerLight();
                      }}
                      style={styles.eyeBtn}>
                      {showPassword ? (
                        <EyeOffIcon size={18} color={theme.textSecondary} />
                      ) : (
                        <EyeIcon size={18} color={theme.textSecondary} />
                      )}
                    </Pressable>
                  </View>
                  {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                </View>

                {/* Submit Action Button */}
                <Pressable
                  disabled={authLoading}
                  onPress={authMode === 'signin' ? handleSignIn : handleSignUp}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    {
                      backgroundColor: theme.brandAccent,
                      marginTop: Spacing.two,
                      opacity: (authLoading || pressed) ? 0.8 : 1
                    }
                  ]}>
                  {authLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnText}>
                      {authMode === 'signin' ? 'Sign In to Sync' : 'Register Account'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* Backup & Restore Section */}
          <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}>
            <View style={styles.sectionHeaderRow}>
              <ClipboardIcon size={20} color={theme.text} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Backup & Restore</Text>
            </View>

            <View style={{ gap: Spacing.three }}>
              <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
                Download your entire workout history, routines, and day plans as a JSON file, or restore them from a previous backup file.
              </Text>

              {backupLoading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginVertical: Spacing.two }}>
                  <ActivityIndicator size="small" color={theme.brandAccent} />
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Processing backup data...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one }}>
                  <Pressable
                    onPress={handleExportBackup}
                    style={[styles.actionBtn, { backgroundColor: theme.brandAccent, flex: 1 }]}>
                    <Text style={styles.actionBtnText}>📤 Export Data</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleImportBackup}
                    style={[styles.actionBtn, { backgroundColor: theme.backgroundSelected, borderWidth: 1, borderColor: theme.textSecondary + '33', flex: 1 }]}>
                    <Text style={[styles.actionBtnText, { color: theme.text }]}>📥 Import Data</Text>
                  </Pressable>
                </View>
              )}
            </View>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    gap: Spacing.three,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: 2,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    padding: 2,
    marginBottom: Spacing.two,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderRadius: Spacing.two - 2,
  },
  toggleTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  toggleTabText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 48,
    gap: Spacing.two,
  },
  formInputNew: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: Spacing.one,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 2,
    marginLeft: Spacing.one,
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
  infoGroup: {
    gap: Spacing.two,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
});
