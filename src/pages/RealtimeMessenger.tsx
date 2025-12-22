/**
 * Dragvertising Real-time Messenger - Complete real-time messaging with Supabase Realtime
 * 
 * Features:
 * - Real-time message updates (Postgres Changes)
 * - Typing indicators (Broadcast)
 * - Online presence (Presence)
 * - Read receipts
 * - Message reactions
 * - Universe-aware messaging
 * - Direct & group conversations
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUniverse } from '@/hooks/shared/useUniverse';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MessageSquare, 
  Search, 
  Send, 
  UserPlus,
  Settings,
  Paperclip,
  Loader2,
  Users,
  X,
  File
} from 'lucide-react';
import { EmojiPicker } from '@/components/shared/EmojiPicker';
import { toast } from '@/hooks/shared/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { PageLoading } from '@/components/ui/loading';

interface Conversation {
  id: string;
  type: string;
  name?: string;
  last_message_at?: string;
  metadata?: any;
  participants: ConversationParticipant[];
  last_message?: {
    content: string;
    sender_profile_universe_id?: string;
    created_at: string;
  };
  unread_count: number;
}

interface ConversationParticipant {
  profile_universe_id: string;
  is_archived: boolean;
  is_muted: boolean;
  is_pinned: boolean;
  last_read_at?: string;
  profile_universe: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    role: string;
  };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_profile_universe_id: string;
  content: string;
  message_type: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  deleted_at?: string;
  reply_to_message_id?: string;
  metadata?: any;
  attachments?: any[];
  sender_profile: {
    handle: string;
    display_name: string;
    avatar_url?: string;
    role: string;
  };
  reactions?: MessageReaction[];
}

interface MessageReaction {
  id: string;
  emoji: string;
  profile_universe_id: string;
  created_at: string;
}

interface TypingIndicator {
  user_id: string;
  display_name: string;
  timestamp: number;
}

interface OnlineUser {
  user_id: string;
  display_name: string;
  online_at: string;
}

export default function RealtimeMessenger() {
  const { user } = useAuth();
  const { universe, isLoading: universeLoading } = useUniverse();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'pinned' | 'archived'>('all');
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingIndicator>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  
  // New message dialog state
  const [isNewMessageDialogOpen, setIsNewMessageDialogOpen] = useState(false);
  const [newMessageSearchQuery, setNewMessageSearchQuery] = useState('');
  const [newMessageSearchResults, setNewMessageSearchResults] = useState<Array<{
    id: string;
    display_name: string;
    handle: string;
    role: string;
    avatar_url?: string;
  }>>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  
  // File attachments state
  const [attachments, setAttachments] = useState<Array<{
    file: File;
    preview?: string;
    uploadProgress?: number;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mobile responsive state
  const [showSidebar, setShowSidebar] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get conversation ID from URL
  const conversationIdFromUrl = searchParams.get('conversation');

  // =====================================================
  // SCROLL TO BOTTOM
  // =====================================================
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // =====================================================
  // LOAD CONVERSATIONS
  // =====================================================
  const loadConversations = useCallback(async () => {
    if (!universe?.id || !user?.id) return;

    try {
      setIsLoading(true);
      
      let conversationIds: string[] = [];
      let participantData: any[] = [];
      
      // Try to load from conversation_participants table first (new schema)
      const { data: participantDataNew, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, is_archived, is_muted, is_pinned, last_read_at')
        .eq('profile_universe_id', universe.id);

      if (!participantsError && participantDataNew && participantDataNew.length > 0) {
        participantData = participantDataNew;
        conversationIds = participantDataNew.map(p => p.conversation_id);
      } else {
        // Fallback: Load from conversations table using participant1/participant2 (old schema)
        const { data: conversationsOld, error: conversationsError } = await supabase
          .from('conversations')
          .select('id, participant1_universe_id, participant2_universe_id')
          .or(`participant1_universe_id.eq.${universe.id},participant2_universe_id.eq.${universe.id}`);

        if (conversationsError) {
          console.error('Error loading conversations:', {
            message: conversationsError.message,
            code: conversationsError.code,
            details: conversationsError.details,
            hint: conversationsError.hint,
            fullError: conversationsError
          });
          throw conversationsError;
        }

        if (conversationsOld && conversationsOld.length > 0) {
          conversationIds = conversationsOld.map(c => c.id);
          // Create participant data structure from old schema
          participantData = conversationsOld.map(c => ({
            conversation_id: c.id,
            is_archived: false,
            is_muted: false,
            is_pinned: false,
            last_read_at: null
          }));
        }
      }

      // If no conversations, return empty array
      if (conversationIds.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      // Load conversation details
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, type, name, last_message_at, metadata')
        .in('id', conversationIds);

      if (conversationsError) {
        console.error('[RealtimeMessenger] Error loading conversations:', conversationsError);
        throw conversationsError;
      }

      // Create conversations map
      const conversationsMap = (conversationsData || []).reduce((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {} as Record<string, any>);

      // Load all participants for these conversations
      // CRITICAL: Query ALL participants (not filtered by current user) so we get both sides
      // The RLS policy now allows users to see all participants in their conversations
      let allParticipants: any[] = [];
      
      // Try to load from conversation_participants table
      const { data: allParticipantsNew, error: allParticipantsError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          profile_universe_id,
          is_archived,
          is_muted,
          is_pinned,
          last_read_at,
          profile_universes:profile_universe_id(
            id,
            handle,
            display_name,
            avatar_url,
            role
          )
        `)
        .in('conversation_id', conversationIds);

      if (!allParticipantsError && allParticipantsNew) {
        allParticipants = allParticipantsNew;
      } else {
        // Fallback: Load from conversations table and build participant structure
        const { data: conversationsData, error: convError } = await supabase
          .from('conversations')
          .select('id, participant1_universe_id, participant2_universe_id')
          .in('id', conversationIds);

        if (!convError && conversationsData) {
          // Build participant structure from old schema
          allParticipants = conversationsData.flatMap(c => {
            const participants: any[] = [];
            if (c.participant1_universe_id) {
              participants.push({
                conversation_id: c.id,
                profile_universe_id: c.participant1_universe_id,
                is_archived: false,
                is_muted: false,
                is_pinned: false,
                last_read_at: null,
                profile_universes: null
              });
            }
            if (c.participant2_universe_id) {
              participants.push({
                conversation_id: c.id,
                profile_universe_id: c.participant2_universe_id,
                is_archived: false,
                is_muted: false,
                is_pinned: false,
                last_read_at: null,
                profile_universes: null
              });
            }
            return participants;
          });
        }
      }
      
      // Debug: Verify we're getting all participants
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeMessenger] All participants from query:', {
          count: allParticipants?.length || 0,
          conversationIds: conversationIds,
          participantsPerConversation: conversationIds.map(convId => ({
            conversation_id: convId,
            count: allParticipants?.filter(p => p.conversation_id === convId).length || 0,
            profile_universe_ids: allParticipants?.filter(p => p.conversation_id === convId).map(p => p.profile_universe_id) || []
          }))
        });
      }
      
      // Debug: Log the query result with full details
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeMessenger] Participants query result:', {
          count: allParticipants?.length || 0,
          error: participantsError,
          sample: allParticipants?.[0],
          sampleKeys: allParticipants?.[0] ? Object.keys(allParticipants[0]) : [],
          sampleProfileUniverses: allParticipants?.[0]?.profile_universes,
          sampleProfileUniversesType: typeof allParticipants?.[0]?.profile_universes,
          isArray: Array.isArray(allParticipants?.[0]?.profile_universes),
          conversationIds: conversationIds,
          allParticipants: allParticipants // Full array for inspection
        });
      }
      
      if (participantsError) {
        console.error('[RealtimeMessenger] Error loading participants:', participantsError);
        throw participantsError;
      }

      // Load last messages for conversations
      const { data: lastMessages, error: messagesError } = await supabase
        .from('messages')
        .select('conversation_id, content, sender_profile_universe_id, created_at')
        .in('conversation_id', conversationIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Debug: Log raw participant data to understand structure
      if (process.env.NODE_ENV === 'development' && allParticipants && allParticipants.length > 0) {
        console.log('[RealtimeMessenger] Raw participant data sample:', {
          firstParticipant: allParticipants[0],
          keys: Object.keys(allParticipants[0]),
          hasProfileUniverses: 'profile_universes' in allParticipants[0],
          profileUniversesType: typeof allParticipants[0].profile_universes,
          profileUniversesValue: allParticipants[0].profile_universes
        });
      }
      
      // Group participants by conversation
      const participantsByConversation = (allParticipants || []).reduce((acc: Record<string, any[]>, p: any) => {
        if (!acc[p.conversation_id]) acc[p.conversation_id] = [];
        
        // Normalize the participant structure - Supabase returns profile_universes as nested object
        // Handle both array and object formats (Supabase can return either depending on join type)
        // Also check for alternative property names that Supabase might use
        let profileUniverse: any = null;
        
        // Try different ways Supabase might return the joined data
        if (p.profile_universes) {
          profileUniverse = Array.isArray(p.profile_universes) 
            ? p.profile_universes[0] 
            : p.profile_universes;
        } else if (p.profile_universe) {
          profileUniverse = p.profile_universe;
        } else if ((p as any).profile_universes_profile_universe_id) {
          profileUniverse = (p as any).profile_universes_profile_universe_id;
        }
        
        // Debug: Log if profile_universe is missing
        if (!profileUniverse && p.profile_universe_id) {
          console.warn('[RealtimeMessenger] Participant missing profile_universes:', {
            conversation_id: p.conversation_id,
            profile_universe_id: p.profile_universe_id,
            rawParticipant: p,
            allKeys: Object.keys(p),
            hasProfileUniverses: 'profile_universes' in p,
            profileUniversesValue: p.profile_universes,
            profileUniversesType: typeof p.profile_universes
          });
        }
        
        acc[p.conversation_id].push({
          profile_universe_id: p.profile_universe_id,
          is_archived: p.is_archived,
          is_muted: p.is_muted,
          is_pinned: p.is_pinned,
          last_read_at: p.last_read_at,
          profile_universe: profileUniverse || null // Normalize to singular for easier access
        });
        return acc;
      }, {} as Record<string, any[]>);
      
      // CRITICAL: Get ALL participant IDs from multiple sources to ensure we have both participants
      // 1. From the raw query results
      const allParticipantIdsFromQuery = [...new Set(
        (allParticipants || [])
          .map(p => p.profile_universe_id)
          .filter(Boolean)
      )];
      
      // 2. From participantsByConversation (grouped results)
      const allParticipantIdsFromGrouped = [...new Set(
        Object.values(participantsByConversation)
          .flat()
          .map(p => p.profile_universe_id)
          .filter(Boolean)
      )];
      
      // Combine both sources to ensure we have ALL participant IDs
      const allProfileUniverseIds = [...new Set([
        ...allParticipantIdsFromQuery, 
        ...allParticipantIdsFromGrouped
      ])];
      
      // Debug: Log what we're about to fetch
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeMessenger] Participant IDs from query:', allParticipantIdsFromQuery);
        console.log('[RealtimeMessenger] Participant IDs from grouped:', allParticipantIdsFromGrouped);
        console.log('[RealtimeMessenger] All participant profile_universe_ids to fetch:', allProfileUniverseIds);
        console.log('[RealtimeMessenger] Participants by conversation before fetch:', 
          Object.keys(participantsByConversation).map(convId => ({
            conversation_id: convId,
            participant_ids: participantsByConversation[convId].map(p => p.profile_universe_id),
            participant_count: participantsByConversation[convId].length
          }))
        );
      }
      
      if (allProfileUniverseIds.length > 0) {
        console.log('[RealtimeMessenger] Fetching all profile_universes to ensure data:', allProfileUniverseIds);
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profile_universes')
          .select('id, handle, display_name, avatar_url, role')
          .in('id', allProfileUniverseIds);
        
        if (profilesError) {
          console.error('[RealtimeMessenger] Error fetching profiles:', profilesError);
        } else if (allProfiles && allProfiles.length > 0) {
          console.log('[RealtimeMessenger] Fetched profiles:', allProfiles.length, 'profiles', allProfiles.map(p => ({ id: p.id, display_name: p.display_name })));
          
          // Create a map for quick lookup
          const profilesMap = new Map(allProfiles.map(p => [p.id, p]));
          
          // Update ALL participants with profiles (overwrite if join didn't work)
          let updatedCount = 0;
          Object.keys(participantsByConversation).forEach(convId => {
            participantsByConversation[convId] = participantsByConversation[convId].map(p => {
              const profile = profilesMap.get(p.profile_universe_id);
              if (profile) {
                updatedCount++;
                // Always use the fetched profile (more reliable than join)
                return { 
                  ...p, 
                  profile_universe: profile 
                };
              } else {
                console.warn('[RealtimeMessenger] Profile not found in fetched profiles:', {
                  profile_universe_id: p.profile_universe_id,
                  available_ids: Array.from(profilesMap.keys())
                });
              }
              return p;
            });
          });
          
          console.log('[RealtimeMessenger] Updated', updatedCount, 'participants with profiles from direct fetch');
        } else {
          console.warn('[RealtimeMessenger] No profiles returned from fetch, expected', allProfileUniverseIds.length);
        }
      } else {
        console.warn('[RealtimeMessenger] No profile_universe_ids to fetch - this should not happen!');
      }
      
      // Debug: Log final participants structure with full details
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeMessenger] Final participantsByConversation:', 
          Object.keys(participantsByConversation).map(convId => ({
            conversation_id: convId,
            participants: participantsByConversation[convId].map(p => ({
              profile_universe_id: p.profile_universe_id,
              has_profile_universe: !!p.profile_universe,
              profile_universe: p.profile_universe,
              profile_universe_display_name: p.profile_universe?.display_name || 'MISSING',
              profile_universe_handle: p.profile_universe?.handle || 'MISSING',
              full_participant: p // Include full participant for debugging
            }))
          }))
        );
      }

      // Group messages by conversation (get last message)
      const lastMessagesByConversation = (lastMessages || []).reduce((acc, m) => {
        if (!acc[m.conversation_id]) acc[m.conversation_id] = m;
        return acc;
      }, {} as Record<string, any>);

      // Calculate unread counts - simplified version
      const unreadCountsMap: Record<string, number> = {};
      
      // Try to use RPC if available, otherwise calculate manually
      try {
        const unreadCounts = await Promise.all(
          conversationIds.map(async (convId) => {
            try {
              const { data, error } = await supabase.rpc('get_unread_message_count', {
                p_universe_id: universe.id,
                p_conversation_id: convId
              });
              if (error) throw error;
              return { conversationId: convId, count: data || 0 };
            } catch {
              // Fallback: count unread messages manually
              const { data: unreadMessages } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', convId)
                .neq('sender_profile_universe_id', universe.id)
                .is('read_at', null)
                .is('deleted_at', null);
              return { conversationId: convId, count: unreadMessages?.length || 0 };
            }
          })
        );
        
        unreadCounts.forEach(({ conversationId, count }) => {
          unreadCountsMap[conversationId] = count;
        });
      } catch (error) {
        console.warn('Error calculating unread counts:', error);
        // Set all to 0 if calculation fails
        conversationIds.forEach(convId => {
          unreadCountsMap[convId] = 0;
        });
      }

      // Build conversation list
      const conversationList: Conversation[] = (participantData || [])
        .map((p: any) => {
          const convData = conversationsMap[p.conversation_id];
          const participants = participantsByConversation[p.conversation_id] || [];
          
          // Skip conversations with no participants or only one participant
          if (participants.length < 2) {
            console.warn('[RealtimeMessenger] Skipping conversation with insufficient participants:', {
              conversation_id: p.conversation_id,
              participant_count: participants.length
            });
            return null;
          }
          
          // Debug: Log conversation being built
          if (process.env.NODE_ENV === 'development') {
            const otherParticipant = participants.find((part: any) => part.profile_universe_id !== universe.id);
            if (!otherParticipant?.profile_universe) {
              console.warn('[RealtimeMessenger] Conversation missing other participant profile:', {
                conversation_id: p.conversation_id,
                participants: participants,
                participant_count: participants.length
              });
            }
          }
          
          return {
            id: p.conversation_id,
            type: convData?.type || 'direct',
            name: convData?.name,
            last_message_at: convData?.last_message_at,
            metadata: convData?.metadata,
            participants: participants,
            last_message: lastMessagesByConversation[p.conversation_id],
            unread_count: unreadCountsMap[p.conversation_id] || 0
          };
        })
        .filter((c): c is Conversation => {
          if (!c) return false;
          return conversationsMap[c.id] !== undefined;
        }); // Only include valid conversations

      // Final check: Ensure all conversations have participant profiles
      const conversationsNeedingProfiles = conversationList.filter((conv: Conversation) => {
        const otherParticipant = conv.participants.find((p: ConversationParticipant) => p.profile_universe_id !== universe.id);
        return !otherParticipant?.profile_universe;
      });
      
      if (conversationsNeedingProfiles.length > 0) {
        console.warn('[RealtimeMessenger] Some conversations are missing participant profiles:', 
          conversationsNeedingProfiles.map(c => ({
            conversation_id: c.id,
            participants: c.participants.map(p => ({
              profile_universe_id: p.profile_universe_id,
              has_profile: !!p.profile_universe
            }))
          }))
        );
      }

      setConversations(conversationList);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [universe?.id, user?.id]);

  // =====================================================
  // LOAD MESSAGES
  // =====================================================
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          sender_profile_universe_id,
          content,
          message_type,
          created_at,
          updated_at,
          edited_at,
          deleted_at,
          reply_to_message_id,
          metadata,
          attachments,
          profile_universes:sender_profile_universe_id(
            id,
            handle,
            display_name,
            avatar_url,
            role
          ),
          message_reactions(
            id,
            emoji,
            profile_universe_id,
            created_at
          )
        `)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Normalize message sender profile - handle different Supabase response formats
      const formattedMessages: Message[] = (data || []).map(m => {
        // Handle different ways Supabase might return the joined profile_universes
        let senderProfile: any = null;
        
        if (m.profile_universes) {
          senderProfile = Array.isArray(m.profile_universes) 
            ? m.profile_universes[0] 
            : m.profile_universes;
        } else if ((m as any).profile_universe) {
          senderProfile = (m as any).profile_universe;
        }
        
        // If sender profile is missing, fetch it separately
        if (!senderProfile && m.sender_profile_universe_id) {
          console.warn('[RealtimeMessenger] Message missing sender profile:', {
            message_id: m.id,
            sender_profile_universe_id: m.sender_profile_universe_id,
            rawMessage: m
          });
        }
        
        // Ensure metadata is an object (handle case where it might be a string)
        let metadata = m.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            console.warn('[RealtimeMessenger] Failed to parse metadata:', e);
            metadata = {};
          }
        }
        
        const message = {
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          sender_profile_universe_id: m.sender_profile_universe_id,
          content: m.content,
          message_type: m.message_type,
          created_at: m.created_at,
          updated_at: m.updated_at,
          edited_at: m.edited_at,
          deleted_at: m.deleted_at,
          reply_to_message_id: m.reply_to_message_id,
          metadata: metadata || {},
          attachments: m.attachments,
          sender_profile: senderProfile || null,
          reactions: m.message_reactions as any
        };
        
        // Debug: Log messages with attachments
        if (message.metadata?.attachments && message.metadata.attachments.length > 0) {
          console.log('[RealtimeMessenger] Loaded message with attachments:', {
            messageId: message.id,
            attachmentCount: message.metadata.attachments.length,
            attachments: message.metadata.attachments,
            metadata: message.metadata
          });
        }
        
        return message;
      });
      
      // Fetch missing sender profiles if needed
      const missingSenderIds = formattedMessages
        .filter(m => !m.sender_profile && m.sender_profile_universe_id)
        .map(m => m.sender_profile_universe_id);
      
      if (missingSenderIds.length > 0) {
        console.log('[RealtimeMessenger] Fetching missing sender profiles:', missingSenderIds);
        const { data: missingSenders, error: senderError } = await supabase
          .from('profile_universes')
          .select('id, handle, display_name, avatar_url, role')
          .in('id', missingSenderIds);
        
        if (!senderError && missingSenders) {
          // Update messages with missing sender profiles
          formattedMessages.forEach(msg => {
            if (!msg.sender_profile && msg.sender_profile_universe_id) {
              const profile = missingSenders.find(p => p.id === msg.sender_profile_universe_id);
              if (profile) {
                msg.sender_profile = profile;
              }
            }
          });
        }
      }

      setMessages(formattedMessages);
      scrollToBottom();

      // Mark messages as read
      if (universe?.id) {
        await supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('profile_universe_id', universe.id);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    }
  }, [universe?.id, scrollToBottom]);

  // =====================================================
  // SEND MESSAGE
  // =====================================================
  const sendMessage = useCallback(async () => {
    // Validate inputs
    if (!newMessage.trim() && attachments.length === 0) {
      toast.error('Please enter a message or attach a file');
      return;
    }

    if (!selectedConversation) {
      toast.error('Please select a conversation');
      return;
    }

    if (!universe?.id) {
      toast.error('Please select a universe to send messages');
      return;
    }

    if (isSending) {
      return; // Already sending
    }

    if (!user) {
      toast.error('You must be logged in to send messages');
      return;
    }

    setIsSending(true);

    // Store message content and attachments for optimistic update
    const messageContent = newMessage.trim() || (attachments.length > 0 ? '📎' : '');
    const messageAttachments = [...attachments];
    const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    // Create optimistic message immediately
    const optimisticMessage: Message = {
      id: tempMessageId,
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      sender_profile_universe_id: universe.id,
      content: messageContent,
      message_type: 'direct',
      created_at: now,
      updated_at: now,
      metadata: messageAttachments.length > 0 ? { attachments: [] } : {},
      attachments: [],
      sender_profile: {
        handle: universe.handle,
        display_name: universe.display_name || universe.handle,
        avatar_url: universe.avatar_url || undefined,
        role: universe.role
      },
      reactions: []
    };

    // Add optimistic message to UI immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setAttachments([]);
    scrollToBottom();

    try {
      // Verify universe belongs to user before sending
      const { data: verifyUniverse, error: verifyError } = await supabase
        .from('profile_universes')
        .select('id, user_id, handle, display_name')
        .eq('id', universe.id)
        .eq('user_id', user?.id)
        .single();

      if (verifyError || !verifyUniverse) {
        console.error('Universe verification failed:', { verifyError, universe, user });
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempMessageId));
        toast.error('Cannot verify universe. Please switch universes and try again.');
        setIsSending(false);
        return;
      }

      // Find recipient from conversation participants
      const otherParticipants = selectedConversation.participants.filter(
        p => p.profile_universe_id !== universe.id
      );
      const recipientUniverseId = otherParticipants[0]?.profile_universe_id;
      const recipientUniverse = otherParticipants[0];

      if (!recipientUniverseId || !recipientUniverse) {
        console.error('Cannot find recipient in conversation participants:', {
          conversation: selectedConversation,
          currentUniverse: universe.id,
          participants: selectedConversation.participants
        });
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempMessageId));
        toast.error('Cannot find recipient. Please refresh and try again.');
        setIsSending(false);
        return;
      }

      // Fetch recipient user_id
      const { data: recipientUniverseData } = await supabase
        .from('profile_universes')
        .select('user_id')
        .eq('id', recipientUniverseId)
        .single();
      const recipientUserId = recipientUniverseData?.user_id;

      console.log('Sending message with universe:', {
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        sender_profile_universe_id: universe.id,
        sender_universe_id: universe.id,
        recipient_universe_id: recipientUniverseId,
        recipient_id: recipientUserId,
        universe_handle: universe.handle,
        content: messageContent
      });

      // Upload attachments if any
      let uploadedAttachments: any[] = [];
      if (messageAttachments.length > 0) {
        setIsUploading(true);
        try {
          const uploadPromises = messageAttachments.map(async (attachment) => {
            const fileExt = attachment.file.name.split('.').pop();
            const fileName = `messages/${user.id}/${universe.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            // Upload to Supabase Storage - use messages-attachments bucket
            const { error: uploadError } = await supabase.storage
              .from('messages-attachments')
              .upload(fileName, attachment.file, {
                cacheControl: '3600',
                upsert: false,
              });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('messages-attachments')
              .getPublicUrl(fileName);

            return {
              name: attachment.file.name,
              type: attachment.file.type,
              size: attachment.file.size,
              url: publicUrl,
              path: fileName
            };
          });

          uploadedAttachments = await Promise.all(uploadPromises);
        } catch (uploadError: any) {
          console.error('Error uploading attachments:', uploadError);
          // Remove optimistic message on error
          setMessages(prev => prev.filter(m => m.id !== tempMessageId));
          toast.error('Failed to upload attachments');
          setIsUploading(false);
          setIsSending(false);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // Build message payload - always include sender_id and recipient_id as they're required (NOT NULL constraints)
      // The messages table requires both user IDs and universe IDs
      const messagePayload: any = {
        conversation_id: selectedConversation.id,
        sender_id: user.id, // Required: sender user ID (NOT NULL constraint)
        sender_universe_id: universe.id, // Required: sender universe ID
        sender_profile_universe_id: universe.id, // Also set profile_universe_id for consistency
        recipient_universe_id: recipientUniverseId, // Required: recipient universe ID
        content: messageContent,
        message_type: 'direct' // Use 'direct' instead of 'text'
      };

      // Include recipient_id if available (may be required by schema)
      if (recipientUserId) {
        messagePayload.recipient_id = recipientUserId;
      } else {
        // If recipientUserId is not available, we still need to set it
        // Try to get it from the recipient universe
        const { data: recipientData } = await supabase
          .from('profile_universes')
          .select('user_id')
          .eq('id', recipientUniverseId)
          .single();
        if (recipientData?.user_id) {
          messagePayload.recipient_id = recipientData.user_id;
        } else {
          // If we still can't get it, we can't send the message
          setMessages(prev => prev.filter(m => m.id !== tempMessageId));
          toast.error('Cannot find recipient user. Please refresh and try again.');
          setIsSending(false);
          return;
        }
      }

      // Include attachments in metadata
      if (uploadedAttachments.length > 0) {
        messagePayload.metadata = {
          ...(messagePayload.metadata || {}),
          attachments: uploadedAttachments
        };
        console.log('[RealtimeMessenger] Sending message with attachments:', {
          attachmentCount: uploadedAttachments.length,
          attachments: uploadedAttachments,
          metadata: messagePayload.metadata
        });
      }

      const { error } = await supabase
        .from('messages')
        .insert(messagePayload); // realtime will hydrate

      if (error) {
        console.error('Error sending message:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          sender_id: user.id,
          sender_universe_id: universe.id,
          conversation_id: selectedConversation.id
        });
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempMessageId));
        throw error;
      }

      // Message will be replaced via Realtime subscription when it arrives
      // The optimistic message will be removed when the real one comes in
      
      // Stop typing indicator
      if (conversationChannelRef.current && user) {
        conversationChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            user_id: universe.id,
            display_name: universe.display_name || universe.handle,
            is_typing: false
          }
        });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [newMessage, selectedConversation, universe, user, isSending, scrollToBottom, navigate, attachments]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file sizes (10MB max per file)
    const maxSize = 10 * 1024 * 1024;
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    // Create previews for images
    const newAttachments = validFiles.map(file => {
      const attachment: { file: File; preview?: string; uploadProgress?: number } = { file };
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
      
      return attachment;
    });

    setAttachments(prev => [...prev, ...newAttachments]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string) => {
    setNewMessage(prev => prev + emoji);
  }, []);

  // =====================================================
  // TYPING INDICATOR
  // =====================================================
  const handleTyping = useCallback(() => {
    if (!conversationChannelRef.current || !universe) return;

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing event
    conversationChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: universe.id,
        display_name: universe.display_name,
        is_typing: true,
        timestamp: Date.now()
      }
    });

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      if (conversationChannelRef.current && universe) {
        conversationChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            user_id: universe.id,
            display_name: universe.display_name,
            is_typing: false
          }
        });
      }
    }, 3000);
  }, [universe]);

  // =====================================================
  // REALTIME: CONVERSATION CHANNEL (Messages + Typing)
  // =====================================================
  useEffect(() => {
    if (!selectedConversation?.id || !universe?.id) {
      return;
    }

    // Set auth for Realtime Authorization
    supabase.realtime.setAuth();

    const channel = supabase
      .channel(`conversation:${selectedConversation.id}:messages`, {
        config: {
          private: true,
          broadcast: { self: true },
          presence: { key: universe.id }
        }
      })
      // Subscribe to new messages via Broadcast (100x faster than postgres_changes)
      .on('broadcast', { event: 'INSERT' }, async (payload) => {
        console.log('[RealtimeMessenger] New message received:', payload);
        
        // According to Supabase docs, broadcast_changes sends:
        // payload.new - the new record
        // payload.old - the old record (for UPDATE/DELETE)
        // payload.event - the event type
        // payload.operation - the operation type
        const messageData = payload.payload?.new || payload.new;
        if (!messageData || !messageData.id) return;
        
        // Check if this message is from the current user (optimistic update replacement)
        const isFromCurrentUser = messageData.sender_profile_universe_id === universe.id;
        
        // If we have sender_profile_universe_id, try to get sender profile from cache or fetch
        let senderProfile: any = null;
        
        // Try to get sender profile from conversation participants first (fastest)
        if (messageData.sender_profile_universe_id) {
          const participant = selectedConversation?.participants.find(
            p => p.profile_universe_id === messageData.sender_profile_universe_id
          );
          if (participant?.profile_universe) {
            senderProfile = participant.profile_universe;
          }
        }
        
        // If sender profile is still missing, fetch it (only if needed)
        if (!senderProfile && messageData.sender_profile_universe_id) {
          const { data: profileData } = await supabase
            .from('profile_universes')
            .select('id, handle, display_name, avatar_url, role')
            .eq('id', messageData.sender_profile_universe_id)
            .single();
          if (profileData) {
            senderProfile = profileData;
          }
        }
        
        // If still missing and it's the current user, use universe data
        if (!senderProfile && isFromCurrentUser && universe) {
          senderProfile = {
            id: universe.id,
            handle: universe.handle,
            display_name: universe.display_name || universe.handle,
            avatar_url: universe.avatar_url,
            role: universe.role
          };
        }
        
        // Ensure metadata is an object (handle case where it might be a string)
        let metadata = messageData.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            console.warn('[RealtimeMessenger] Failed to parse metadata from realtime:', e);
            metadata = {};
          }
        }
        
        const newMessage: Message = {
          id: messageData.id,
          conversation_id: messageData.conversation_id,
          sender_id: messageData.sender_id,
          sender_profile_universe_id: messageData.sender_profile_universe_id,
          content: messageData.content,
          message_type: messageData.message_type,
          created_at: messageData.created_at,
          updated_at: messageData.updated_at,
          edited_at: messageData.edited_at,
          deleted_at: messageData.deleted_at,
          reply_to_message_id: messageData.reply_to_message_id,
          metadata: metadata || {},
          attachments: messageData.attachments || [],
          sender_profile: senderProfile,
          reactions: []
        };
        
        console.log('[RealtimeMessenger] Adding message from realtime:', {
          messageId: newMessage.id,
          isFromCurrentUser,
          hasMetadata: !!newMessage.metadata,
          hasAttachments: !!(newMessage.metadata?.attachments && newMessage.metadata.attachments.length > 0),
          attachmentCount: newMessage.metadata?.attachments?.length || 0
        });
        
        // Update messages: replace optimistic message if it exists, otherwise add new
        setMessages(prev => {
          // Remove any optimistic messages with temp IDs from current user
          const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.sender_profile_universe_id === universe.id));
          
          // Check if message already exists (shouldn't happen, but handle it)
          const exists = filtered.some(m => m.id === newMessage.id);
          if (exists) {
            return filtered;
          }
          
          // Add the new message
          return [...filtered, newMessage];
        });
        
        scrollToBottom();
      })
      // Subscribe to message updates (edits) via Broadcast (100x faster than postgres_changes)
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        console.log('[RealtimeMessenger] Message updated via broadcast:', payload);
        // For UPDATE, use payload.new (the updated record)
        const messageData = payload.payload?.new || payload.new;
        if (messageData && messageData.id) {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === messageData.id 
                ? { ...msg, ...messageData }
                : msg
            )
          );
        }
      })
      // Subscribe to message deletions via Broadcast (100x faster than postgres_changes)
      .on('broadcast', { event: 'DELETE' }, (payload) => {
        console.log('[RealtimeMessenger] Message deleted via broadcast:', payload);
        // For DELETE, use payload.old (the deleted record)
        const messageData = payload.payload?.old || payload.old;
        if (messageData && messageData.id) {
          setMessages(prev => prev.filter(msg => msg.id !== messageData.id));
        }
      })
      // Subscribe to typing indicators
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, display_name, is_typing, timestamp } = payload.payload;
        
        // Don't show own typing indicator
        if (user_id === universe.id) return;

        if (is_typing) {
          setTypingUsers(prev => new Map(prev).set(user_id, {
            user_id,
            display_name,
            timestamp: timestamp || Date.now()
          }));
        } else {
          setTypingUsers(prev => {
            const next = new Map(prev);
            next.delete(user_id);
            return next;
          });
        }
      })
      .subscribe((status) => {
        console.log('[RealtimeMessenger] Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeMessenger] Successfully subscribed to conversation channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeMessenger] Channel subscription error');
        }
      });

    conversationChannelRef.current = channel;

    return () => {
      console.log('[RealtimeMessenger] Unsubscribing from conversation channel');
      channel.unsubscribe();
      conversationChannelRef.current = null;
    };
  }, [selectedConversation?.id, universe?.id, scrollToBottom, loadMessages]);

  // =====================================================
  // REALTIME: PRESENCE CHANNEL (Online Status)
  // =====================================================
  useEffect(() => {
    if (!universe?.id) return;

    // Set auth for Realtime Authorization
    const setRealtimeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      } else {
        supabase.realtime.setAuth();
      }
    };
    setRealtimeAuth();

    // Use universe-specific channel for presence (matches RLS policies)
    const channel = supabase
      .channel(`universe:${universe.id}:conversations`, {
        config: {
          private: true,
          presence: { key: universe.id }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state: RealtimePresenceState<OnlineUser> = channel.presenceState();
        const users = new Map<string, OnlineUser>();
        
        Object.entries(state).forEach(([, presences]) => {
          presences.forEach((presence: any) => {
            users.set(presence.user_id, presence);
          });
        });
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('[Presence] User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('[Presence] User left:', leftPresences);
      })
      .subscribe(async (status) => {
        console.log('[Presence] Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: universe.id,
            display_name: universe.display_name,
            online_at: new Date().toISOString()
          });
          console.log('[Presence] Tracking presence for universe:', universe.id);
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
      presenceChannelRef.current = null;
    };
  }, [universe?.id, universe?.display_name]);

  // =====================================================
  // AUTO-CLEANUP STALE TYPING INDICATORS
  // =====================================================
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const next = new Map(prev);
        let changed = false;
        
        next.forEach((indicator, userId) => {
          if (now - indicator.timestamp > 5000) {
            next.delete(userId);
            changed = true;
          }
        });
        
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // =====================================================
  // REALTIME: CONVERSATIONS LIST CHANNEL
  // =====================================================
  useEffect(() => {
    if (!universe?.id || !user?.id) return;

    // Set auth for Realtime Authorization
    supabase.realtime.setAuth();

    // Subscribe to conversation list updates for this universe
    const conversationsListChannel = supabase
      .channel(`universe:${universe.id}:conversations`, {
        config: { private: true }
      })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        console.log('[RealtimeMessenger] Conversation INSERT received:', payload);
        loadConversations();
      })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        console.log('[RealtimeMessenger] Conversation UPDATE received:', payload);
        loadConversations();
      })
      .on('broadcast', { event: 'DELETE' }, (payload) => {
        console.log('[RealtimeMessenger] Conversation DELETE received:', payload);
        loadConversations();
      })
      .subscribe((status) => {
        console.log('[RealtimeMessenger] Conversations list channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeMessenger] Successfully subscribed to conversations list updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeMessenger] Conversations list channel error');
        }
      });

    return () => {
      console.log('[RealtimeMessenger] Unsubscribing from conversations list channel');
      supabase.removeChannel(conversationsListChannel);
    };
  }, [universe?.id, user?.id, loadConversations]);

  // =====================================================
  // LOAD DATA ON MOUNT
  // =====================================================
  useEffect(() => {
    if (universe?.id) {
      loadConversations();
    }
  }, [universe?.id, loadConversations]);

  // =====================================================
  // LOAD MESSAGES WHEN CONVERSATION CHANGES
  // =====================================================
  useEffect(() => {
    if (selectedConversation?.id) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id, loadMessages]);

  // =====================================================
  // SELECT CONVERSATION FROM URL
  // =====================================================
  useEffect(() => {
    if (conversationIdFromUrl && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === conversationIdFromUrl);
      if (conversation) {
        setSelectedConversation(conversation);
        // Hide sidebar on mobile when conversation is selected from URL
        if (window.innerWidth < 768) {
          setShowSidebar(false);
        }
      }
    }
  }, [conversationIdFromUrl, conversations]);

  // =====================================================
  // FILTER CONVERSATIONS
  // =====================================================
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Apply filter type
    if (filterType === 'unread') {
      filtered = filtered.filter(c => c.unread_count > 0);
    } else if (filterType === 'pinned') {
      filtered = filtered.filter(c => 
        c.participants.some(p => 
          p.profile_universe_id === universe?.id && p.is_pinned
        )
      );
    } else if (filterType === 'archived') {
      filtered = filtered.filter(c => 
        c.participants.some(p => 
          p.profile_universe_id === universe?.id && p.is_archived
        )
      );
    } else {
      // 'all' - exclude archived
      filtered = filtered.filter(c => 
        !c.participants.some(p => 
          p.profile_universe_id === universe?.id && p.is_archived
        )
      );
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const otherParticipants = c.participants.filter(
          p => p.profile_universe_id !== universe?.id
        );
        return (
          c.name?.toLowerCase().includes(query) ||
          c.last_message?.content.toLowerCase().includes(query) ||
          otherParticipants.some(p => 
            p.profile_universe.display_name?.toLowerCase().includes(query) ||
            p.profile_universe.handle?.toLowerCase().includes(query)
          )
        );
      });
    }

    return filtered;
  }, [conversations, filterType, searchQuery, universe?.id]);

  // =====================================================
  // TYPING INDICATOR TEXT
  // =====================================================
  const typingIndicatorText = useMemo(() => {
    const typingArray = Array.from(typingUsers.values());
    if (typingArray.length === 0) return null;
    
    if (typingArray.length === 1) {
      return `${typingArray[0].display_name} is typing...`;
    } else if (typingArray.length === 2) {
      return `${typingArray[0].display_name} and ${typingArray[1].display_name} are typing...`;
    } else {
      return `${typingArray.length} people are typing...`;
    }
  }, [typingUsers]);

  // =====================================================
  // HANDLERS (Must be before early returns)
  // =====================================================
  const handleNewMessage = () => {
    setIsNewMessageDialogOpen(true);
  };

  const handleBackToConversations = () => {
    setSelectedConversation(null);
    setSearchParams({});
    setShowSidebar(true);
  };

  // Search for users to message
  const searchUsersForMessage = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setNewMessageSearchResults([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profile_universes')
        .select('id, display_name, handle, role, avatar_url, status, user_id')
        .or(`display_name.ilike.%${query}%,handle.ilike.%${query}%`)
        .eq('status', 'active')
        .neq('id', universe?.id) // Don't show current user's universe
        // Allow messaging any other universe (no role restrictions)
        .limit(50); // Get more results to deduplicate

      if (error) throw error;

      // Deduplicate by handle (prefer one universe per user)
      // Priority: prefer certain roles, but show only one per handle
      const seenHandles = new Set<string>();
      const deduplicated = (data || [])
        .filter((u) => {
          // Skip if we've already seen this handle
          if (seenHandles.has(u.handle)) {
            return false;
          }
          seenHandles.add(u.handle);
          return true;
        })
        .slice(0, 20); // Limit to 20 results

      setNewMessageSearchResults(deduplicated);
    } catch (error: any) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setIsSearchingUsers(false);
    }
  }, [universe?.id]);

  // Handle search query change
  const handleNewMessageSearchChange = useCallback((value: string) => {
    setNewMessageSearchQuery(value);
    searchUsersForMessage(value);
  }, [searchUsersForMessage]);

  // Start a new conversation with a user
  const startConversation = useCallback(async (recipientUniverseId: string) => {
    if (!universe?.id || !user?.id) {
      toast.error('Please select a universe first');
      return;
    }

    try {
      // Use direct database operations to get or create conversation
      const { getOrCreateConversation } = await import('@/lib/messenger/conversationUtils');
      const conversationId = await getOrCreateConversation(
        universe.id,
        recipientUniverseId
      );

      // Check if conversation is already in our list
      const existingConversation = conversations.find(c => c.id === conversationId);
      
      if (existingConversation) {
        // Conversation exists in list, just select it
        setSelectedConversation(existingConversation);
        setSearchParams({ conversation: conversationId });
      } else {
        // Conversation is new or not loaded yet, reload and select
        await loadConversations();
        setSearchParams({ conversation: conversationId });
      }

      setIsNewMessageDialogOpen(false);
      setNewMessageSearchQuery('');
      setNewMessageSearchResults([]);
      toast.success('Conversation started');
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      toast.error(error.message || 'Failed to start conversation');
    }
  }, [universe?.id, user?.id, conversations, loadConversations, setSearchParams]);

  // =====================================================
  // LOADING STATE (After all hooks)
  // =====================================================
  if (universeLoading || isLoading) {
    return <PageLoading />;
  }

  // Check authentication
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Please log in to access messages</p>
        </div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Please select a universe to access messages</p>
          <p className="text-sm text-muted-foreground">Universe selection will be available soon</p>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================
  return (
    <>
    <div className="h-screen flex bg-background relative overflow-hidden">
        {/* Mobile Overlay */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black/50 z-10 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
        
        {/* Conversations List */}
        <div className={cn(
          "flex-shrink-0 border-r bg-card flex flex-col transition-transform duration-300 ease-in-out",
          "w-full md:w-96",
          "absolute md:relative inset-0 z-20 md:z-auto",
          showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
          {/* Header */}
          <div className="p-3 md:p-4 border-b bg-card/95 backdrop-blur">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                {/* Mobile menu button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden"
                  onClick={() => setShowSidebar(false)}
                  title="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg md:text-xl font-bold tracking-tight">Messages</h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    {filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 md:h-9 md:w-9"
                onClick={handleNewMessage}
                title="New message"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Search */}
            <div className="relative mb-2 md:mb-3">
              <Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3.5 md:h-4 w-3.5 md:w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-7 md:pl-9 h-8 md:h-9 text-sm md:text-base bg-background/50 border-border/50 focus-visible:ring-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex gap-1 md:gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {['all', 'unread', 'pinned', 'archived'].map((filter) => (
                <Button
                  key={filter}
                  variant={filterType === filter ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterType(filter as any)}
                  className={cn(
                    "h-6 md:h-7 text-[10px] md:text-xs font-medium transition-all whitespace-nowrap flex-shrink-0",
                    filterType === filter 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-muted/50"
                  )}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No conversations</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery ? 'No conversations match your search' : 'Start a new conversation to get started'}
                </p>
                {!searchQuery && (
                  <Button onClick={handleNewMessage}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    New Message
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-1 md:p-2 space-y-0.5">
                {filteredConversations.map((conversation) => {
                const otherParticipants = conversation.participants.filter(
                  p => p.profile_universe_id !== universe.id
                );
                
                // Get the other participant's profile_universe
                // Handle both direct access and nested structure
                const otherParticipant = otherParticipants[0];
                const participant = otherParticipant?.profile_universe || null;
                
                // Debug: Log participant structure if missing
                if (process.env.NODE_ENV === 'development') {
                  if (!participant && otherParticipant) {
                    console.warn('[RealtimeMessenger] Missing participant profile in render:', {
                      conversation_id: conversation.id,
                      otherParticipant: otherParticipant,
                      hasProfileUniverse: !!otherParticipant?.profile_universe,
                      profileUniverseId: otherParticipant?.profile_universe_id,
                      allKeys: otherParticipant ? Object.keys(otherParticipant) : []
                    });
                  }
                }
                const isOnline = participant && onlineUsers.has(participant.id);
                
                // Determine if this is a group or show conversation
                const isGroup = conversation.type === 'group';
                const isShow = conversation.type === 'show';
                
                // For group/show conversations, use the conversation name
                // For direct messages, use the other participant's name
                // CRITICAL: If participant profile is missing, try to fetch it
                let displayName = 'Unknown';
                if (isGroup || isShow) {
                  displayName = conversation.name || `${conversation.type} conversation`;
                } else if (participant?.display_name) {
                  displayName = participant.display_name;
                } else if (conversation.name) {
                  displayName = conversation.name;
                } else if (otherParticipant?.profile_universe_id) {
                  // Profile is missing - this should have been loaded by the fallback
                  // Log warning and show profile_universe_id as fallback
                  if (process.env.NODE_ENV === 'development') {
                    console.error('[RealtimeMessenger] CRITICAL: Participant profile missing in render:', {
                      conversation_id: conversation.id,
                      profile_universe_id: otherParticipant.profile_universe_id,
                      participant: otherParticipant
                    });
                  }
                  displayName = `User ${otherParticipant.profile_universe_id.slice(0, 8)}...`;
                }
                
                // For group/show, show participant count or icon
                const participantCount = conversation.participants.length;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setSelectedConversation(conversation);
                        setSearchParams({ conversation: conversation.id });
                        // Hide sidebar on mobile when conversation is selected
                        if (window.innerWidth < 768) {
                          setShowSidebar(false);
                        }
                      }}
                      className={cn(
                        "w-full p-2 md:p-3 rounded-lg md:rounded-xl text-left transition-all group",
                        "hover:bg-accent/50 active:scale-[0.98]",
                        selectedConversation?.id === conversation.id 
                          ? "bg-accent shadow-sm border border-border/50" 
                          : "hover:border-border/30"
                      )}
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <div className="relative flex-shrink-0">
                          {isGroup || isShow ? (
                            // Group/Show icon with participant count
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-2 ring-primary/10">
                              {isShow ? (
                                <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                              ) : (
                                <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                              )}
                              {participantCount > 2 && (
                                <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[9px] md:text-[10px] font-semibold rounded-full h-4 w-4 md:h-5 md:w-5 flex items-center justify-center ring-2 ring-background">
                                  {participantCount}
                                </span>
                              )}
                            </div>
                          ) : (
                            // Direct message avatar
                            <Avatar className="h-10 w-10 md:h-12 md:w-12 ring-2 ring-background">
                              <AvatarImage src={participant?.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm md:text-base">
                                {participant?.display_name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {isOnline && !isGroup && !isShow && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 bg-green-500 rounded-full border-2 border-background ring-1 ring-green-500/20" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 md:gap-2 mb-0.5 md:mb-1">
                            <p className={cn(
                              "font-semibold text-xs md:text-sm truncate",
                              conversation.unread_count > 0 && "font-bold"
                            )}>
                              {displayName}
                            </p>
                            {conversation.last_message_at && (
                              <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                {formatDistanceToNow(new Date(conversation.last_message_at), {
                                  addSuffix: false
                                })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <p className={cn(
                              "text-xs md:text-sm truncate flex-1",
                              conversation.unread_count > 0 
                                ? "text-foreground font-medium" 
                                : "text-muted-foreground"
                            )}>
                              {conversation.last_message?.content || 'No messages yet'}
                            </p>
                            {conversation.unread_count > 0 && (
                              <Badge 
                                variant="default" 
                                className="ml-auto flex-shrink-0 h-4 md:h-5 min-w-[18px] md:min-w-[20px] px-1 md:px-1.5 text-[10px] md:text-xs font-semibold"
                              >
                                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col bg-background relative">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="border-b p-3 md:p-4 flex items-center justify-between bg-card/50 backdrop-blur sticky top-0 z-10">
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                  {/* Back button for mobile */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 md:hidden flex-shrink-0"
                    onClick={handleBackToConversations}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {(() => {
                    const otherParticipants = selectedConversation.participants.filter(
                      p => p.profile_universe_id !== universe.id
                    );
                    const otherParticipant = otherParticipants[0];
                    const participant = otherParticipant?.profile_universe || null;
                    
                    // Debug: Log if participant profile is missing
                    if (process.env.NODE_ENV === 'development' && !participant && otherParticipant) {
                      console.warn('[RealtimeMessenger] Header missing participant profile:', {
                        conversation_id: selectedConversation.id,
                        otherParticipant: otherParticipant,
                        profile_universe_id: otherParticipant?.profile_universe_id
                      });
                    }
                    const isOnline = participant && onlineUsers.has(participant.id);
                    const isGroup = selectedConversation.type === 'group';
                    const isShow = selectedConversation.type === 'show';

                    return (
                      <>
                        <div className="relative">
                          {isGroup || isShow ? (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-2 ring-primary/10">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                          ) : (
                            <Avatar className="h-10 w-10 ring-2 ring-background">
                              <AvatarImage src={participant?.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                                {participant?.display_name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {isOnline && !isGroup && !isShow && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background ring-1 ring-green-500/20" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">
                            {(() => {
                              if (selectedConversation.name) return selectedConversation.name;
                              if (participant?.display_name) return participant.display_name;
                              if (otherParticipant?.profile_universe_id) {
                                // Profile missing - should have been loaded
                                if (process.env.NODE_ENV === 'development') {
                                  console.error('[RealtimeMessenger] CRITICAL: Header participant profile missing:', {
                                    conversation_id: selectedConversation.id,
                                    profile_universe_id: otherParticipant.profile_universe_id
                                  });
                                }
                                return `User ${otherParticipant.profile_universe_id.slice(0, 8)}...`;
                              }
                              return 'Unknown';
                            })()}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isGroup || isShow 
                              ? `${selectedConversation.participants.length} ${selectedConversation.participants.length === 1 ? 'participant' : 'participants'}`
                              : isOnline ? 'Online' : 'Offline'
                            }
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9"
                    onClick={() => toast.info('Conversation settings coming soon')}
                    title="Conversation settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12">
                      <div className="rounded-full bg-muted p-4 mb-3">
                        <MessageSquare className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((message, index) => {
                      const isMe = message.sender_profile_universe_id === universe.id;
                      const prevMessage = index > 0 ? messages[index - 1] : null;
                      const showAvatar = !prevMessage || prevMessage.sender_profile_universe_id !== message.sender_profile_universe_id;
                      const showTime = !prevMessage || 
                        (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) > 300000; // 5 minutes

                      return (
                        <div key={message.id}>
                          {showTime && (
                            <div className="flex items-center justify-center my-6">
                              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                                {formatDistanceToNow(new Date(message.created_at), {
                                  addSuffix: false
                                })}
                              </span>
                            </div>
                          )}
                          <div
                            className={cn(
                              "flex gap-3 group",
                              isMe && "flex-row-reverse"
                            )}
                          >
                            {showAvatar ? (
                              <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-background">
                                <AvatarImage src={message.sender_profile?.avatar_url} />
                                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-semibold">
                                  {message.sender_profile?.display_name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="w-8" />
                            )}

                            <div className={cn("flex flex-col max-w-[70%]", isMe && "items-end")}>
                              {showAvatar && !isMe && (
                                <span className="text-xs text-muted-foreground mb-1 px-1">
                                  {message.sender_profile?.display_name || 'Unknown'}
                                </span>
                              )}
                              <div
                                className={cn(
                                  "rounded-2xl px-4 py-2.5 shadow-sm transition-all",
                                  "group-hover:shadow-md",
                                  isMe
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-card border border-border rounded-bl-md"
                                )}
                              >
                                {/* Attachments */}
                                {(() => {
                                  const messageAttachments = message.metadata?.attachments || [];
                                  if (messageAttachments.length > 0) {
                                    console.log('[RealtimeMessenger] Rendering attachments:', {
                                      messageId: message.id,
                                      attachmentCount: messageAttachments.length,
                                      attachments: messageAttachments
                                    });
                                  }
                                  return null;
                                })()}
                                {message.metadata?.attachments && message.metadata.attachments.length > 0 && (
                                  <div className="mb-2 space-y-2">
                                    {message.metadata.attachments.map((attachment: any, idx: number) => (
                                      <div key={idx} className="rounded-lg overflow-hidden">
                                        {attachment.type?.startsWith('image/') ? (
                                          <a
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block"
                                          >
                                            <img
                                              src={attachment.url}
                                              alt={attachment.name}
                                              className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                            />
                                          </a>
                                        ) : (
                                          <a
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn(
                                              "flex items-center gap-2 p-3 rounded-lg border transition-colors",
                                              isMe
                                                ? "bg-primary/20 border-primary/30 hover:bg-primary/30"
                                                : "bg-muted/50 border-border hover:bg-muted"
                                            )}
                                          >
                                            <File className="h-5 w-5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium truncate">{attachment.name}</p>
                                              <p className="text-xs opacity-70">
                                                {(attachment.size / 1024).toFixed(1)} KB
                                              </p>
                                            </div>
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Message Content */}
                                {message.content && message.content !== '📎' && (
                                  <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {message.content}
                                  </p>
                                )}
                              </div>
                              
                              {/* Reactions */}
                              {message.reactions && message.reactions.length > 0 && (
                                <div className="flex gap-1 mt-1.5">
                                  {message.reactions.map((reaction) => (
                                    <span key={reaction.id} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                      {reaction.emoji}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <span className="text-xs text-muted-foreground mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatDistanceToNow(new Date(message.created_at), {
                                  addSuffix: true
                                })}
                                {message.edited_at && ' (edited)'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Typing Indicator */}
                {typingIndicatorText && (
                  <div className="px-3 md:px-6 pb-2">
                    <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground">
                      <div className="flex gap-0.5 md:gap-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="italic truncate">{typingIndicatorText}</span>
                    </div>
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="border-t p-2 md:p-4 bg-card/50 backdrop-blur">
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5 md:gap-2">
                    {attachments.map((attachment, index) => (
                      <div key={index} className="relative group">
                        {attachment.preview ? (
                          <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border border-border">
                            <img 
                              src={attachment.preview} 
                              alt={attachment.file.name}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="absolute top-0.5 right-0.5 md:top-1 md:right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 md:p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg border border-border bg-muted flex items-center justify-center">
                            <File className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="absolute top-0.5 right-0.5 md:top-1 md:right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 md:p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            </button>
                            <span className="absolute bottom-0.5 left-0.5 right-0.5 md:bottom-1 md:left-1 md:right-1 text-[9px] md:text-[10px] text-muted-foreground truncate px-0.5 md:px-1">
                              {attachment.file.name}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newMessage.trim() && attachments.length === 0) return;
                    sendMessage();
                  }}
                  className="flex items-end gap-1.5 md:gap-2"
                >
                  <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 md:h-9 md:w-9"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach file"
                      disabled={isUploading}
                    >
                      <Paperclip className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  </div>
                  <div className="flex-1 relative">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      disabled={isSending}
                      className="min-h-[40px] md:min-h-[44px] max-h-[100px] md:max-h-[120px] pr-10 md:pr-12 text-sm md:text-base bg-background border-border/50 focus-visible:ring-2 resize-none"
                      rows={1}
                      style={{ 
                        minHeight: '40px',
                        maxHeight: '100px',
                        resize: 'none'
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${Math.min(target.scrollHeight, window.innerWidth < 768 ? 100 : 120)}px`;
                      }}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSending || isUploading || (!newMessage.trim() && attachments.length === 0)}
                    size="icon"
                    className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
                  >
                    {(isSending || isUploading) ? (
                      <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-muted/20 via-background to-background">
              <div className="text-center max-w-md px-4 md:px-6">
                <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 mb-4 md:mb-6">
                  <MessageSquare className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-2">Select a conversation</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">
                  Choose a conversation from the list to start messaging, or start a new one
                </p>
                <Button onClick={handleNewMessage} size="default" className="text-sm md:text-base">
                  <UserPlus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                  Start New Conversation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Message Dialog */}
      <Dialog open={isNewMessageDialogOpen} onOpenChange={setIsNewMessageDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              Search for a user to start a conversation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={newMessageSearchQuery}
                onChange={(e) => handleNewMessageSearchChange(e.target.value)}
                placeholder="Search by name or handle..."
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Search Results */}
            {isSearchingUsers && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearchingUsers && newMessageSearchQuery.length >= 2 && newMessageSearchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No users found
              </div>
            )}

            {!isSearchingUsers && newMessageSearchResults.length > 0 && (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-1">
                  {newMessageSearchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => startConversation(user.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback>
                          {user.display_name?.charAt(0) || user.handle?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {user.display_name || user.handle}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          @{user.handle}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {newMessageSearchQuery.length < 2 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Type at least 2 characters to search
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

