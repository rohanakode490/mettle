import React from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react-native';
import TodayWorkoutScreen from '@/app/index';
import * as queries from '@/db/queries';

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement('View', props, children),
    },
    FadeIn: { duration: () => ({}) },
    Layout: { springify: () => ({}) },
  };
});

// Mock Worklets
jest.mock('react-native-worklets', () => ({}));

// Mock useTheme hook
jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    text: '#ffffff',
    textSecondary: '#B0B4BA',
    textPrimary: '#ffffff',
  }),
}));

// Define stable database instance to prevent infinite render loops
const mockDb = {
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
};

// Mock Expo SQLite
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDb,
  SQLiteProvider: ({ children }: any) => children,
}));

// Mock Expo Symbols
jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

// Mock Expo Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 0 },
  NotificationFeedbackType: { Success: 0 },
}));

// Mock react-native-gesture-handler/Swipeable specifically as a default export
jest.mock('react-native-gesture-handler/Swipeable', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, renderRightActions, ...props }: any) => {
      const childrenArray = [
        React.cloneElement(children, { key: 'swipeable-child' }),
      ];
      if (renderRightActions) {
        childrenArray.push(
          React.createElement('View', { key: 'swipeable-right-actions' }, renderRightActions())
        );
      }
      return React.createElement('View', props, childrenArray);
    },
  };
});

// Mock react-native-gesture-handler named exports
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  return {
    GestureHandlerRootView: ({ children, ...props }: any) => React.createElement('View', props, children),
  };
});

// Mock Safe Area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));

// Mock Queries
jest.mock('@/db/queries');

const mockRoutines = [
  { id: 'default-routine', name: 'Mettle Strength Split', createdAt: Date.now() },
];

const mockDayPlanMonday = {
  id: 'dp-monday',
  routineId: 'default-routine',
  dayIndex: 0, // Monday
  isRest: false,
  exercisePlans: [
    { id: 'ex-1', name: 'Barbell Bench Press', targetSets: '1', targetReps: '8-12' },
  ],
};

const mockDayPlanTuesday = {
  id: 'dp-tuesday',
  routineId: 'default-routine',
  dayIndex: 1, // Tuesday
  isRest: false,
  exercisePlans: [
    { id: 'ex-2', name: 'Barbell Row', targetSets: '1', targetReps: '8-12' },
  ],
};

const mockSetLogs: any[] = [];

describe('TodayWorkoutScreen Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Safely mock only getDay on the Date prototype to represent Monday (index 1)
    // This keeps the Date constructor and time elapsed/timer functions intact for waitFor.
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
    
    // Default mocks behavior
    (queries.getRoutines as jest.Mock).mockResolvedValue(mockRoutines);
    (queries.getDayPlans as jest.Mock).mockResolvedValue([mockDayPlanMonday, mockDayPlanTuesday]);
    (queries.getSetLogs as jest.Mock).mockResolvedValue(mockSetLogs);
    (queries.getLastSetLogForExercise as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Test Suite 1: Clicking Checkmark Twice Unchecks/Deletes a Set', async () => {
    await render(<TodayWorkoutScreen />);

    // Flush all asynchronous database loading updates inside act to avoid overlapping updates warning
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    const inputs = screen.queryAllByPlaceholderText('0');
    expect(inputs.length).toBeGreaterThan(0);

    // 1. Inputs weight and reps (inputs[0] is weight, inputs[1] is reps)
    const weightInput = inputs[0];
    const repsInput = inputs[1];

    // Wrap state changes in act blocks and await them to ensure they commit
    await act(async () => {
      fireEvent.changeText(weightInput, '60');
    });
    await act(async () => {
      fireEvent.changeText(repsInput, '10');
    });

    // Click the checkmark trigger
    (queries.insertSetLog as jest.Mock).mockResolvedValueOnce(undefined);
    
    // Find the cellCheck button
    const checkmarkButton = weightInput.parent?.children[5]; // cellCheck column is index 5
    if (!checkmarkButton) {
      throw new Error('Checkmark button not found');
    }
    
    await act(async () => {
      fireEvent.press(checkmarkButton as any);
    });

    expect(queries.insertSetLog).toHaveBeenCalledTimes(1);

    // Mock that getSetLogs now returns the logged set
    const loggedSetId = (queries.insertSetLog as jest.Mock).mock.calls[0][1].id;
    (queries.getSetLogs as jest.Mock).mockResolvedValue([
      {
        id: loggedSetId,
        exerciseName: 'Barbell Bench Press',
        weightKg: 60,
        reps: 10,
        timestamp: Date.now(),
        routineId: 'default-routine',
        dayIndex: 0,
        setType: 'work',
      },
    ]);

    // 3. Second click on the checked set (no changes to inputs)
    (queries.deleteSetLog as jest.Mock).mockResolvedValueOnce(undefined);

    // Query the checkmark button fresh from the active render tree since the old reference is unmounted
    const freshInputs = screen.queryAllByPlaceholderText('0');
    const freshWeightInput = freshInputs[0];
    const freshCheckmarkButton = freshWeightInput.parent?.children[5];
    if (!freshCheckmarkButton) {
      throw new Error('Fresh checkmark button not found');
    }

    await act(async () => {
      fireEvent.press(freshCheckmarkButton as any);
    });

    expect(queries.deleteSetLog).toHaveBeenCalledTimes(1);
    expect(queries.deleteSetLog).toHaveBeenCalledWith(expect.anything(), loggedSetId);
  });

  test('Test Suite 2: Add Extra Set Workflow', async () => {
    await render(<TodayWorkoutScreen />);

    // Flush all asynchronous database loading updates inside act
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    // Initial check: 1 row visible (means 2 inputs: weight and reps)
    let inputs = screen.queryAllByPlaceholderText('0');
    expect(inputs.length).toBe(2);

    // Click ADD EXTRA SET
    const addSetButton = screen.getByText('+ ADD EXTRA SET');
    await act(async () => {
      fireEvent.press(addSetButton);
    });

    // Assert: Now 2 input rows visible (means 4 inputs: 2 weights, 2 reps)
    inputs = screen.queryAllByPlaceholderText('0');
    expect(inputs.length).toBe(4);
  });

  test('Test Suite 3: Alternate Plan Swapping & Reset Workflow', async () => {
    await render(<TodayWorkoutScreen />);

    // Flush all asynchronous database loading updates
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    // 1. Initial check: Displays Monday's exercise ("Barbell Bench Press")
    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    expect(screen.queryByText('Barbell Row')).toBeNull();

    // 2. Open the swap modal
    const swapButton = screen.getByText('Swap Plan / Do Missed Day');
    await act(async () => {
      fireEvent.press(swapButton);
    });

    // 3. Select Tuesday's plan
    // In our mock modal, the items list days: "Tuesday"
    const tuesdayItem = screen.getByText('Tuesday');
    await act(async () => {
      fireEvent.press(tuesdayItem);
    });

    // Flush async updates after selection
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    // 4. Assert: Tuesday's exercise ("Barbell Row") is now shown, and Monday's is hidden
    expect(screen.getByText('Barbell Row')).toBeTruthy();
    expect(screen.queryByText('Barbell Bench Press')).toBeNull();

    // 5. Assert: Alternative Workout Banner is visible
    expect(screen.getByText('Alternative Workout Plan')).toBeTruthy();
    expect(screen.getByText("Currently logging Tuesday's plan for Monday.")).toBeTruthy();

    // 6. Reset the plan back to Monday
    const resetButton = screen.getByText('Reset');
    await act(async () => {
      fireEvent.press(resetButton);
    });

    // Flush async updates after reset
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    // 7. Assert: Returned back to Monday's plan
    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    expect(screen.queryByText('Barbell Row')).toBeNull();
    expect(screen.queryByText('Alternative Workout Plan')).toBeNull();
  });

  test('Test Suite 4: Deleting a set when previous values exist (last week of the same day)', async () => {
    // 1. Mock a previous set log from last week of the same day
    const lastWeekWeight = '70';
    const lastWeekReps = '10';
    (queries.getLastSetLogForExercise as jest.Mock).mockResolvedValue({
      weightKg: parseFloat(lastWeekWeight),
      reps: parseInt(lastWeekReps, 10),
    });

    // Start with empty logs for today
    const todayLogs: any[] = [];
    (queries.getSetLogs as jest.Mock).mockResolvedValue(todayLogs);

    // 2. Render TodayWorkoutScreen
    await render(<TodayWorkoutScreen />);

    // Flush all asynchronous database loading updates inside act
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    // 3. Verify that the previous week's values are loaded as placeholders
    // Since mockDayPlanMonday has 1 target set, we check for 1 set row.
    let weightInputs = screen.queryAllByPlaceholderText(lastWeekWeight);
    let repsInputs = screen.queryAllByPlaceholderText(lastWeekReps);
    expect(weightInputs.length).toBe(1);
    expect(repsInputs.length).toBe(1);

    // Add extra set so we have 2 sets (user only wants to do 2 sets but we'll show 2)
    const addSetButton = screen.getByText('+ ADD EXTRA SET');
    await act(async () => {
      fireEvent.press(addSetButton);
    });

    // Flush state updates
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    // Now we should have 2 sets. Both should have placeholders from the previous values
    weightInputs = screen.queryAllByPlaceholderText(lastWeekWeight);
    repsInputs = screen.queryAllByPlaceholderText(lastWeekReps);
    expect(weightInputs.length).toBe(2);
    expect(repsInputs.length).toBe(2);

    // Let's log the first set today by filling it in and checking it
    await act(async () => {
      fireEvent.changeText(weightInputs[0], '70');
    });
    await act(async () => {
      fireEvent.changeText(repsInputs[0], '10');
    });

    // Check first set
    (queries.insertSetLog as jest.Mock).mockResolvedValueOnce(undefined);
    const checkmarkButton1 = weightInputs[0].parent?.children[5];
    if (!checkmarkButton1) {
      throw new Error('Checkmark button for set 1 not found');
    }
    await act(async () => {
      fireEvent.press(checkmarkButton1 as any);
    });

    expect(queries.insertSetLog).toHaveBeenCalledTimes(1);
    const loggedSetId1 = (queries.insertSetLog as jest.Mock).mock.calls[0][1].id;

    // Mock that getSetLogs now returns the logged set today
    (queries.getSetLogs as jest.Mock).mockResolvedValue([
      {
        id: loggedSetId1,
        exerciseName: 'Barbell Bench Press',
        weightKg: 70,
        reps: 10,
        timestamp: Date.now(),
        routineId: 'default-routine',
        dayIndex: 0,
        setType: 'work',
      },
    ]);

    // Let's also log the second set
    await act(async () => {
      fireEvent.changeText(weightInputs[1], '72.5');
    });
    await act(async () => {
      fireEvent.changeText(repsInputs[1], '9');
    });

    // Check second set
    (queries.insertSetLog as jest.Mock).mockResolvedValueOnce(undefined);
    const checkmarkButton2 = weightInputs[1].parent?.children[5];
    if (!checkmarkButton2) {
      throw new Error('Checkmark button for set 2 not found');
    }
    await act(async () => {
      fireEvent.press(checkmarkButton2 as any);
    });

    expect(queries.insertSetLog).toHaveBeenCalledTimes(2);
    const loggedSetId2 = (queries.insertSetLog as jest.Mock).mock.calls[1][1].id;

    // Mock getSetLogs to return both logged sets today
    (queries.getSetLogs as jest.Mock).mockResolvedValue([
      {
        id: loggedSetId1,
        exerciseName: 'Barbell Bench Press',
        weightKg: 70,
        reps: 10,
        timestamp: Date.now(),
        routineId: 'default-routine',
        dayIndex: 0,
        setType: 'work',
      },
      {
        id: loggedSetId2,
        exerciseName: 'Barbell Bench Press',
        weightKg: 72.5,
        reps: 9,
        timestamp: Date.now(),
        routineId: 'default-routine',
        dayIndex: 0,
        setType: 'work',
      },
    ]);

    // Re-query the inputs to update state in tests
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    // Now, the user wants to delete/remove the second set from today's workout.
    // They can use swipe to delete on the second set.
    (queries.deleteSetLog as jest.Mock).mockResolvedValueOnce(undefined);

    // Let's find the delete button for set index 1 of exercise index 0 (which is delete-set-0-1)
    const deleteButton = screen.getByTestId('delete-set-0-1');
    await act(async () => {
      fireEvent.press(deleteButton);
    });

    // Verify deleteSetLog is called with the second logged set ID to remove it from the DB
    expect(queries.deleteSetLog).toHaveBeenCalledTimes(1);
    expect(queries.deleteSetLog).toHaveBeenCalledWith(expect.anything(), loggedSetId2);
  });

  test('getLastSetLogForExercise is queried with a cutoff timestamp to exclude current session logs', async () => {
    await render(<TodayWorkoutScreen />);

    await act(async () => {
      // Flush database load
    });

    expect(queries.getLastSetLogForExercise).toHaveBeenCalled();
    const calls = (queries.getLastSetLogForExercise as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(typeof calls[0][2]).toBe('number');
  });
});
