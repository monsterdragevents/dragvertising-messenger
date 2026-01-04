/**
 * Messaging Service - Centralized service for messaging operations
 * 
 * Note: This service uses direct Supabase queries instead of edge functions.
 * Edge functions can be added later if additional server-side logic is needed.
 */

import { supabase } from '@/integrations/supabase/client';

export interface CreateMessageData {
  recipient_id: string; // universe_id
  content: string;
  subject?: string | null;
  show_id?: string | null;
  message_type?: string;
  conversation_id?: string;
  metadata?: Record<string, any>;
  attachments?: any[];
  reply_to_message_id?: string;
}

export const messagingService = {
  /**
   * Create a message using direct Supabase query
   */
  createMessage: async (messageData: CreateMessageData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated to create messages');
    }

    // Get or create conversation if conversation_id not provided
    let conversationId = messageData.conversation_id;
    if (!conversationId && messageData.recipient_id) {
      // Get current user's universe
      const { data: currentUniverse } = await supabase
        .from('profile_universes')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!currentUniverse?.id) {
        throw new Error('Could not find current user universe');
      }

      // Import getOrCreateConversation
      const { getOrCreateConversation } = await import('@/lib/messenger/conversationUtils');
      conversationId = await getOrCreateConversation(currentUniverse.id, messageData.recipient_id);
    }

    if (!conversationId) {
      throw new Error('Conversation ID or recipient ID is required');
    }

    // Get sender universe
    const { data: senderUniverse } = await supabase
      .from('profile_universes')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!senderUniverse?.id) {
      throw new Error('Could not find sender universe');
    }

    // Create message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_profile_universe_id: senderUniverse.id,
        content: messageData.content,
        message_type: messageData.message_type || 'text',
        attachments: messageData.attachments || null,
        reply_to_message_id: messageData.reply_to_message_id || null,
        metadata: messageData.metadata || {}
      })
      .select(`
        *,
        profile_universes:sender_profile_universe_id(
          id,
          handle,
          display_name,
          avatar_url,
          role
        )
      `)
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to create message');
    }

    return data;
  },

  /**
   * Get messages using direct Supabase query
   */
  getMessages: async (filters?: {
    conversation_id?: string;
    recipient_id?: string;
    sender_id?: string;
    show_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    let query = supabase
      .from('messages')
      .select(`
        *,
        profile_universes:sender_profile_universe_id(
          id,
          handle,
          display_name,
          avatar_url,
          role
        ),
        message_reactions:message_reactions(
          id,
          emoji,
          profile_universe_id,
          created_at,
          profile_universes:profile_universe_id(
            id,
            handle,
            display_name,
            avatar_url
          )
        )
      `)
      .is('deleted_at', null);

    if (filters?.conversation_id) {
      query = query.eq('conversation_id', filters.conversation_id);
    }

    if (filters?.sender_id) {
      query = query.eq('sender_id', filters.sender_id);
    }

    if (filters?.show_id) {
      query = query.eq('metadata->>show_id', filters.show_id);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || 'Failed to get messages');
    }

    return data || [];
  },
};

