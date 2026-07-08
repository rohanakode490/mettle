-- Supabase SQL Schema for Mettle Sync
-- Create this schema in your Supabase SQL Editor.

-- Enable Row Level Security (RLS) on all tables for user isolation.

-- 1. routines Table
CREATE TABLE IF NOT EXISTS public.routines (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own routines" 
ON public.routines 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);


-- 2. day_plans Table
CREATE TABLE IF NOT EXISTS public.day_plans (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    routine_id TEXT NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    day_index INTEGER NOT NULL,
    is_rest INTEGER NOT NULL DEFAULT 0,
    exercise_plans JSONB NOT NULL
);

ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own day plans" 
ON public.day_plans 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);


-- 3. set_logs Table
CREATE TABLE IF NOT EXISTS public.set_logs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    weight_kg DOUBLE PRECISION NOT NULL,
    reps INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    routine_id TEXT NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    day_index INTEGER NOT NULL,
    set_type TEXT NOT NULL,
    superset_id TEXT
);

ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own set logs" 
ON public.set_logs 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
