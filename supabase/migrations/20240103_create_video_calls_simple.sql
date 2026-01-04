-- Create video calls table for invitation flow
CREATE TABLE IF NOT EXISTS video_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    caller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    caller_profile_universe_id UUID NOT NULL REFERENCES profile_universes(id) ON DELETE CASCADE,
    callee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    callee_profile_universe_id UUID NOT NULL REFERENCES profile_universes(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('initiating', 'ringing', 'accepted', 'rejected', 'ended', 'missed', 'busy')) DEFAULT 'initiating',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    end_reason TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_calls_conversation_id ON video_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_callee_user_id ON video_calls(callee_user_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_status_created ON video_calls(status, created_at);

-- Enable RLS
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Users can view their video calls" ON video_calls
    FOR SELECT USING (
        auth.uid() = caller_user_id OR 
        auth.uid() = callee_user_id
    );

CREATE POLICY IF NOT EXISTS "Users can create video calls as caller" ON video_calls
    FOR INSERT WITH CHECK (
        auth.uid() = caller_user_id
    );

CREATE POLICY IF NOT EXISTS "Users can update their video calls" ON video_calls
    FOR UPDATE USING (
        auth.uid() = caller_user_id OR 
        auth.uid() = callee_user_id
    );