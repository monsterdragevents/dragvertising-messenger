/**
 * Messaging Service - Centralized service for messaging operations
 */

import { edgeFunctionService } from './edgeFunctionService';

export interface CreateMessageData {
  recipient_id: string; // universe_id
  content: string;
  subject?: string | null;
  show_id?: string | null;
  message_type?: string;
  conversation_id?: string;
  metadata?: Record<string, any>;
}

export const messagingService = {
  /**
   * Create a message using edge function
   */
  createMessage: async (messageData: CreateMessageData) => {
    const result = await edgeFunctionService.callFunction('create-message', {
      messageData
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to create message');
    }

    const data = result.data as any;
    return data.message || data;
  },

  /**
   * Get messages using edge function
   */
  getMessages: async (filters?: {
    conversation_id?: string;
    recipient_id?: string;
    sender_id?: string;
    show_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const result = await edgeFunctionService.callFunction('get-messages', filters || {});

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get messages');
    }

    const data = result.data as any;
    return data.messages || (Array.isArray(data) ? data : []) || [];
  },
};

