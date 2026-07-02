# Glossary Configuration - _config/glossary.md

> [!NOTE]
> This file defines terms and domain-specific vocabulary used throughout the Mettle application.

## 1. Domain Terminology

### Routine
A routines container representing a named workout program or training split (e.g., "Push-Pull-Legs", "Upper-Lower").

### Day Plan
A 7-day routine tracker representing a specific day index (0 = Monday, 6 = Sunday) containing planned exercises and whether it is designated as a rest day.

### Exercise Plan
A planned exercise structure inside a Day Plan. Contains name, target sets count, target reps range, and an optional superset pairing.

### Set Log
An actual logged/recorded instance of a completed set. Tracks weights (kg), repetitions completed, type of set, routine context, day index, and superset context.

### Set Types
- **Work (`work`):** Standard working set targeting the main rep/weight zone.
- **Warmup (`warmup`):** Preparation set with lower weight to warm up the muscles.
- **Dropset (`dropset`):** A set where weight is immediately reduced upon failure to squeeze out more repetitions.

### Superset
Exercises performed back-to-back with minimal rest. In the database, they share a matching `supersetId` and are rendered visually grouped inside a distinct outline card.

### Estimated One-Rep Max (1RM)
A theoretical calculation representing the maximum weight an individual can lift for a single repetition of an exercise.
- Formula: $weight \times (1 + reps/30)$

### Volume
Total weight moved during a set or workout.
- Formula: $weight \times reps$
