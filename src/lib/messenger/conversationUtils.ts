/**
 * Conversation Utilities
 * Direct database operations for getting/creating conversations
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Get or create a conversation between two universes
 */
export async function getOrCreateConversation(
  universe1Id: string,
  universe2Id: string
): Promise<string> {
  // Ensure participant1 < participant2 for unique constraint
  const participant1Id = universe1Id < universe2Id ? universe1Id : universe2Id;
  const participant2Id = universe1Id < universe2Id ? universe2Id : universe1Id;

  // First, try to find existing conversation
  const { data: existing, error: queryError } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant1_universe_id', participant1Id)
    .eq('participant2_universe_id', participant2Id)
    .maybeSingle();

  if (queryError) {
    console.error('Error querying conversations:', queryError);
    throw new Error('Failed to query conversations: ' + queryError.message);
  }

  // If conversation exists, return its ID
  if (existing?.id) {
    return existing.id;
  }

  // Get current user to find which universe they own (for created_by)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User must be authenticated to create conversations');
  }

  // Find which universe belongs to the current user (for created_by field)
  const { data: userUniverse, error: universeError } = await supabase
    .from('profile_universes')
    .select('id')
    .in('id', [participant1Id, participant2Id])
    .eq('user_id', user.id)
    .maybeSingle();

  if (universeError) {
    console.error('Error finding user universe:', universeError);
  }

  // Use the user's universe as created_by, or fallback to participant1
  const createdBy = userUniverse?.id || participant1Id;

  // Create new conversation
  const { data: newConversation, error: insertError } = await supabase
    .from('conversations')
    .insert({
      participant1_universe_id: participant1Id,
      participant2_universe_id: participant2Id,
      created_by: createdBy,
      type: 'direct',
    })
    .select('id')
    .single();

  if (insertError) {
    // If it's a unique constraint violation, try to fetch the conversation again
    if (insertError.code === '23505') {
      const { data: raceConditionConv, error: raceError } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant1_universe_id', participant1Id)
        .eq('participant2_universe_id', participant2Id)
        .maybeSingle();

      if (raceError || !raceConditionConv) {
        throw new Error('Failed to create conversation: ' + insertError.message);
      }

      return raceConditionConv.id;
    }

    throw new Error('Failed to create conversation: ' + insertError.message);
  }

  if (!newConversation?.id) {
    throw new Error('Failed to create conversation: No ID returned');
  }

  // Create conversation_participants entries for both participants
  const participants = [
    { conversation_id: newConversation.id, profile_universe_id: participant1Id },
    { conversation_id: newConversation.id, profile_universe_id: participant2Id }
  ];

  const { error: participantsError } = await supabase
    .from('conversation_participants')
    .upsert(participants, {
      onConflict: 'conversation_id,profile_universe_id',
      ignoreDuplicates: true
    });

  if (participantsError) {
    console.warn('Error creating conversation_participants:', participantsError);
  }

  return newConversation.id;
}

