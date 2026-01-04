-- Video Calls Table
-- Manages video call state for invitation flow

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
    end_reason TEXT,
    
    -- Ensure only one active call per conversation
    CONSTRAINT active_call_per_conversation CHECK (
        status = 'ended' OR 
        status = 'rejected' OR 
        status = 'missed' OR
        status = 'busy' OR
        (SELECT COUNT(*) FROM video_calls vc2 
         WHERE vc2.conversation_id = video_calls.conversation_id 
         AND vc2.status IN ('initiating', 'ringing', 'accepted') 
         AND vc2.id != video_calls.id) = 0
    )
);

-- Create index for efficient lookups
CREATE INDEX idx_video_calls_conversation_id ON video_calls(conversation_id);
CREATE INDEX idx_video_calls_callee_user_id ON video_calls(callee_user_id);
CREATE INDEX idx_video_calls_status_created ON video_calls(status, created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_video_calls_updated_at 
    BEFORE UPDATE ON video_calls 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see calls they are involved in
CREATE POLICY "Users can view their own video calls" ON video_calls
    FOR SELECT USING (
        auth.uid() = caller_user_id OR 
        auth.uid() = callee_user_id
    );

-- Policy: Users can insert calls where they are the caller
CREATE POLICY "Users can create video calls as caller" ON video_calls
    FOR INSERT WITH CHECK (
        auth.uid() = caller_user_id
    );

-- Policy: Users can update calls they are involved in
CREATE POLICY "Users can update their video calls" ON video_calls
    FOR UPDATE USING (
        auth.uid() = caller_user_id OR 
        auth.uid() = callee_user_id
    );

-- Function to create a video call with proper validation
CREATE OR REPLACE FUNCTION create_video_call(
    p_conversation_id UUID,
    p_callee_user_id UUID,
    p_callee_profile_universe_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_call_id UUID;
    v_caller_profile_universe_id UUID;
    v_existing_call_id UUID;
BEGIN
    -- Verify caller has a profile in the conversation's universe
    SELECT pu.id INTO v_caller_profile_universe_id
    FROM profile_universes pu
    JOIN conversation_participants cp ON cp.profile_universe_id = pu.id
    JOIN conversations c ON cp.conversation_id = c.id
    WHERE cp.conversation_id = p_conversation_id
      AND pu.user_id = auth.uid()
      AND c.is_active = true
      AND cp.is_active = true;
    
    IF v_caller_profile_universe_id IS NULL THEN
        RAISE EXCEPTION 'Caller is not a participant in this conversation';
    END IF;
    
    -- Check for existing active call
    SELECT id INTO v_existing_call_id
    FROM video_calls
    WHERE conversation_id = p_conversation_id
      AND status IN ('initiating', 'ringing', 'accepted');
    
    IF v_existing_call_id IS NOT NULL THEN
        RETURN v_existing_call_id; -- Return existing call ID
    END IF;
    
    -- Create the call
    INSERT INTO video_calls (
        conversation_id,
        room_name,
        caller_user_id,
        caller_profile_universe_id,
        callee_user_id,
        callee_profile_universe_id,
        status
    ) VALUES (
        p_conversation_id,
        'conversation_' || p_conversation_id::TEXT,
        auth.uid(),
        v_caller_profile_universe_id,
        p_callee_user_id,
        p_callee_profile_universe_id,
        'ringing'
    ) RETURNING id INTO v_call_id;
    
    RETURN v_call_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept a video call
CREATE OR REPLACE FUNCTION accept_video_call(p_call_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_call RECORD;
BEGIN
    -- Lock the row for update
    SELECT * INTO v_call
    FROM video_calls
    WHERE id = p_call_id
      AND callee_user_id = auth.uid()
      AND status = 'ringing'
    FOR UPDATE;
    
    IF v_call IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update call status
    UPDATE video_calls
    SET status = 'accepted',
        accepted_at = NOW()
    WHERE id = p_call_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a video call
CREATE OR REPLACE FUNCTION reject_video_call(p_call_id UUID, p_reason TEXT DEFAULT 'rejected')
RETURNS BOOLEAN AS $$
DECLARE
    v_call RECORD;
BEGIN
    -- Lock the row for update
    SELECT * INTO v_call
    FROM video_calls
    WHERE id = p_call_id
      AND callee_user_id = auth.uid()
      AND status IN ('ringing', 'initiating')
    FOR UPDATE;
    
    IF v_call IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update call status
    UPDATE video_calls
    SET status = 'rejected',
        ended_at = NOW(),
        end_reason = p_reason
    WHERE id = p_call_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a video call
CREATE OR REPLACE FUNCTION end_video_call(p_call_id UUID, p_reason TEXT DEFAULT 'ended')
RETURNS BOOLEAN AS $$
DECLARE
    v_call RECORD;
BEGIN
    -- Lock the row for update
    SELECT * INTO v_call
    FROM video_calls
    WHERE id = p_call_id
      AND (caller_user_id = auth.uid() OR callee_user_id = auth.uid())
      AND status IN ('accepted', 'ringing')
    FOR UPDATE;
    
    IF v_call IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update call status
    UPDATE video_calls
    SET status = 'ended',
        ended_at = NOW(),
        end_reason = p_reason
    WHERE id = p_call_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark missed calls
CREATE OR REPLACE FUNCTION mark_missed_calls()
RETURNS VOID AS $$
BEGIN
    UPDATE video_calls
    SET status = 'missed',
        ended_at = NOW(),
        end_reason = 'timeout'
    WHERE status = 'ringing'
      AND created_at < NOW() - INTERVAL '30 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;