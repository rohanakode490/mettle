export interface Routine {
  id: string;
  name: string;
  createdAt: number; // Unix timestamp
}

export interface DayPlan {
  id: string;
  routineId: string;
  dayIndex: number;
  isRest: boolean;
  exercisePlans: {
    id: string;
    name: string;
    targetSets: string;
    targetReps: string;
    supersetId?: string;
  }[];
}

export interface SetLog {
  id: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  timestamp: number;
  routineId: string;
  dayIndex: number;
  setType: 'work' | 'warmup' | 'dropset';
  supersetId?: string;
}
