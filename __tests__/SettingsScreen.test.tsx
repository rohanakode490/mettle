import React from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings';
import * as queries from '@/db/queries';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

// Mock Reanimated & Worklets
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement('View', props, children),
    },
  };
});
jest.mock('react-native-worklets', () => ({}));

// Mock useTheme hook
jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    text: '#ffffff',
    textSecondary: '#B0B4BA',
    brandAccent: '#ffffff',
  }),
}));

// Mock Expo SQLite
const mockDb = {};
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDb,
}));

// Mock Expo Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 0 },
  NotificationFeedbackType: { Success: 0 },
}));

// Mock Safe Area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock Supabase
jest.mock('@/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('{"mock": "content"}'),
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

// Mock Queries
jest.mock('@/db/queries', () => ({
  exportBackupData: jest.fn(),
  importBackupData: jest.fn(),
}));

describe('SettingsScreen Backup & Restore Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Export Backup Flow works successfully', async () => {
    const mockBackupJson = '{"version":1,"routines":[],"dayPlans":[],"setLogs":[]}';
    (queries.exportBackupData as jest.Mock).mockResolvedValue(mockBackupJson);

    await render(<SettingsScreen />);

    // Find and press Export Data button
    const exportBtnText = screen.getByText('📤 Export Data');
    let pressable = exportBtnText;
    while (pressable && pressable.type !== 'View' && pressable.parent) {
      pressable = pressable.parent as any;
    }
    
    // Fallback to parent if needed
    const targetPressable = pressable || exportBtnText.parent || exportBtnText;

    await act(async () => {
      fireEvent.press(targetPressable);
    });

    // Wait for any async microtasks
    await act(async () => {
      await Promise.resolve();
    });

    // Check that exportBackupData was called
    expect(queries.exportBackupData).toHaveBeenCalledWith(mockDb);

    // Check that file was written to FileSystem
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///mock-doc-dir/mettle-backup-'),
      mockBackupJson,
      { encoding: 'utf8' }
    );

    // Check that sharing dialog was opened
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///mock-doc-dir/mettle-backup-'),
      expect.objectContaining({
        mimeType: 'application/json',
        dialogTitle: 'Export Workout History Backup',
      })
    );
  });

  test('Import Backup Flow works successfully', async () => {
    // Spy on Alert.alert to simulate pressing 'Import'
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    (queries.importBackupData as jest.Mock).mockResolvedValue({
      routinesImported: 2,
      dayPlansImported: 14,
      setLogsImported: 120,
    });

    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///mock-picker-uri/backup.json', name: 'backup.json' }],
    });

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('{"version":1}');

    await render(<SettingsScreen />);

    // Press Import Data button
    const importBtnText = screen.getByText('📥 Import Data');
    let importPressable = importBtnText;
    while (importPressable && importPressable.type !== 'View' && importPressable.parent) {
      importPressable = importPressable.parent as any;
    }
    const targetImportPressable = importPressable || importBtnText.parent || importBtnText;

    await act(async () => {
      fireEvent.press(targetImportPressable);
    });

    // Check if Alert dialog was shown to confirm import
    expect(alertSpy).toHaveBeenCalledWith(
      'Import Backup',
      expect.any(String),
      expect.any(Array)
    );

    // Get the third argument (buttons array) of Alert.alert call and trigger the 'Import' onPress
    const alertButtons = alertSpy.mock.calls[0][2];
    const importButton = alertButtons?.find(btn => btn.text === 'Import');
    if (!importButton || !importButton.onPress) {
      throw new Error('Import button in Alert not found');
    }

    // Trigger the onPress of the Alert's Import button
    await act(async () => {
      await importButton.onPress();
    });

    // Verify document picker was called
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    // Verify FileSystem read was called
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-picker-uri/backup.json',
      { encoding: 'utf8' }
    );

    // Verify importBackupData query was called
    expect(queries.importBackupData).toHaveBeenCalledWith(mockDb, '{"version":1}');

    // Verify final success alert was shown
    expect(alertSpy).toHaveBeenLastCalledWith(
      'Import Successful',
      expect.stringContaining('Successfully imported:\n- 2 routines\n- 14 day plans\n- 120 set logs.')
    );
  });

  test('Import Backup Flow shows detailed validation errors', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const validationErrorMsg = 'Routine at index 0 is missing a valid string "id".';
    (queries.importBackupData as jest.Mock).mockRejectedValue(new Error(validationErrorMsg));

    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///mock-picker-uri/backup-invalid.json', name: 'backup-invalid.json' }],
    });

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('{"invalid": true}');

    await render(<SettingsScreen />);

    // Press Import Data button
    const importBtnText = screen.getByText('📥 Import Data');
    let importPressable = importBtnText;
    while (importPressable && importPressable.type !== 'View' && importPressable.parent) {
      importPressable = importPressable.parent as any;
    }
    const targetImportPressable = importPressable || importBtnText.parent || importBtnText;

    await act(async () => {
      fireEvent.press(targetImportPressable);
    });

    // Get the Alert and trigger Import onPress
    const alertButtons = alertSpy.mock.calls[0][2];
    const importButton = alertButtons?.find(btn => btn.text === 'Import');
    if (!importButton || !importButton.onPress) {
      throw new Error('Import button in Alert not found');
    }

    await act(async () => {
      await importButton.onPress();
    });

    // Verify import failed alert was shown with the validation details
    expect(alertSpy).toHaveBeenLastCalledWith(
      'Import Failed',
      expect.stringContaining(`Invalid backup file or format.\nDetails: ${validationErrorMsg}`)
    );
  });
});
