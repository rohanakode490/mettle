import React, { useState, useCallback } from 'react';
import { Modal, StyleSheet, Text, View, Pressable } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export interface AlertOption {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  options: AlertOption[];
}

export function useCustomAlert() {
  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    options: [],
  });

  const showAlert = useCallback((title: string, message: string, options?: AlertOption[]) => {
    setAlert({
      visible: true,
      title,
      message,
      options: options || [{ text: 'OK' }],
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlert(prev => ({ ...prev, visible: false }));
  }, []);

  const handleOptionPress = useCallback((option: AlertOption) => {
    hideAlert();
    if (option.onPress) {
      option.onPress();
    }
  }, [hideAlert]);

  const CustomAlertComponent = () => {
    const theme = useTheme();
    
    if (!alert.visible) return null;

    // Determine direction layout based on button lengths/counts
    const isStacked = alert.options.length > 2;

    return (
      <Modal
        transparent
        visible={alert.visible}
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <Pressable style={styles.overlay} onPress={hideAlert}>
          <Pressable 
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary + '1a' }]}
            onPress={e => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: theme.text }]}>{alert.title}</Text>
            <Text style={[styles.message, { color: theme.textSecondary }]}>{alert.message}</Text>
            
            <View style={[styles.buttonContainer, isStacked && { flexDirection: 'column' }]}>
              {alert.options.map((option, idx) => {
                const isCancel = option.style === 'cancel';
                const isDestructive = option.style === 'destructive';
                
                let btnBg = theme.brandAccent;
                let textColor = '#ffffff';
                
                if (isCancel) {
                  btnBg = theme.backgroundSelected;
                  textColor = theme.text;
                } else if (isDestructive) {
                  btnBg = 'rgba(239, 68, 68, 0.1)';
                  textColor = '#ef4444';
                }

                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleOptionPress(option)}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: btnBg },
                      pressed && { opacity: 0.8 },
                      isStacked && { width: '100%', flex: 0 }
                    ]}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>
                      {option.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  return {
    showAlert,
    CustomAlert: CustomAlertComponent,
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '90%',
    maxWidth: 300,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
