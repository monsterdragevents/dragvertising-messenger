/**
 * Dragvertising Real-time Messenger - Refactored Clean Version
 * 
 * Simplified architecture with modular components and better error handling
 */

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUniverse } from '@/hooks/shared/useUniverse';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ConversationList } from '@/components/messenger/ConversationList';
import { MessageArea } from '@/components/messenger/MessageArea';
import { MessageInput } from '@/components/messenger/MessageInput';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Avatar, AvatarFallback, AvatarImage } from '@/lib/design-system';
import { Loader2, UserPlus, X, Menu, Video, Search, Bell, BellOff } from 'lucide-react';
import { toast } from '@/hooks/shared/use-toast';
import { cn } from '@/lib/utils';
import { getOrCreateConversation } from '@/lib/messenger/conversationUtils';
import { useDebounce } from '@/hooks/shared/useDebounce';
import { useVideoCallInvitations } from '@/hooks/shared/useVideoCallInvitations';

// Lazy load heavy components
const UniverseSwitcher = lazy(() => import('@/components/shared/UniverseSwitcher').then(module => ({ default: module.UniverseSwitcher })));
const VoiceMessageButton = lazy(() => import('@/components/shared/VoiceMessageButton').then(module => ({ default: module.VoiceMessageButton })));
const VideoCallDialog = lazy(() => import('@/components/shared/VideoCallDialog').then(module => ({ default: module.VideoCallDialog })));

// Types
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
  profile_universe?: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
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
  updated_at?: string;
  edited_at?: string;
  deleted_at?: string;
  reply_to_message_id?: string;
  read_at?: string;
  metadata?: any;
  attachments?: any[];
  sender_profile?: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    role?: string;
  };
  reactions?: any[];
  reply_to_message?: any;
}

export default function RealtimeMessenger() {
  const { user, session } = useAuth();
  const { universe } = useUniverse();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // UI State
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread' | 'pinned' | 'archived'>('all');
  const [isNewMessageDialogOpen, setIsNewMessageDialogOpen] = useState(false);
  const [newMessageSearchQuery, setNewMessageSearchQuery] = useState('');
  const [newMessageSearchResults, setNewMessageSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  
  // Mobile responsive state
  const [showSidebar, setShowSidebar] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  
  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<Map<string, { user_id: string; display_name: string; timestamp: number }>>(new Map());
  
  // Online presence
  const [onlineUsers, setOnlineUsers] = useState<Map<string, { universe_id: string; display_name: string; last_seen?: string }>>(new Map());
  
  // Message search
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  
  // Video call
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  
  // Reply to message
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  
  // Image lightbox
  const [selectedImage, setSelectedImage] = useState<{ url: string; name?: string } | null>(null);

  // Refs
  const conversationChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // =====================================================
  // REALTIME AUTH SETUP
  // =====================================================
  useEffect(() => {
    if (!session?.access_token) return;

    console.log('[RealtimeMessenger] Setting Realtime auth');
    supabase.realtime.setAuth(session.access_token);
  }, [session?.access_token]);

  // =====================================================
  // VIDEO CALL INVITATIONS
  // =====================================================
  const videoCallInvitations = useVideoCallInvitations({
    onIncomingCall: (call) => {
      console.log('[RealtimeMessenger] Incoming call received:', call);
      setIncomingCall(call);
      setIsVideoCallOpen(true);
      
      // Find the conversation and select it
      const conversation = conversations.find(c => c.id === call.conversation_id);
      if (conversation) {
        setSelectedConversation(conversation);
      }
    },
    onCallStatusChange: (call) => {
      console.log('[RealtimeMessenger] Call status changed:', call);
      if (call.status === 'ended' || call.status === 'rejected') {
        setIncomingCall(null);
        if (call.id === incomingCall?.id) {
          setIsVideoCallOpen(false);
        }
      }
    }
  });

  // =====================================================
  // LOAD CONVERSATIONS
  // =====================================================
  const loadConversations = useCallback(async () => {
    if (!universe?.id || !user?.id) {
      setIsLoadingConversations(false);
      return;
    }

    setIsLoadingConversations(true);
    try {
      console.log('[RealtimeMessenger] Loading conversations for universe:', universe.id);

      // Get conversations where user is a participant
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          is_archived,
          is_muted,
          is_pinned,
          last_read_at,
          profile_universe_id,
          profile_universes:profile_universe_id(
            id,
            handle,
            display_name,
            avatar_url
          )
        `)
        .eq('profile_universe_id', universe.id)
        .is('left_at', null);

      if (participantsError) throw participantsError;
      if (!participants || participants.length === 0) {
        setConversations([]);
        setIsLoadingConversations(false);
        return;
      }

      const conversationIds = participants.map(p => p.conversation_id);

      // Get conversation details
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds);

      if (conversationsError) throw conversationsError;

      // Get last messages for each conversation
      const { data: lastMessages, error: messagesError } = await supabase
        .from('messages')
        .select('conversation_id, content, sender_profile_universe_id, created_at')
        .in('conversation_id', conversationIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (messagesError) console.warn('Error loading last messages:', messagesError);

      // Get all participants for each conversation
      const { data: allParticipants, error: allParticipantsError } = await supabase
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
            avatar_url
          )
        `)
        .in('conversation_id', conversationIds)
        .is('left_at', null);

      if (allParticipantsError) console.warn('Error loading all participants:', allParticipantsError);

      // Build conversation list and count unread messages
      const conversationMap = new Map<string, Conversation>();
      
      // Get all messages for unread counting (more efficient than per-conversation queries)
      const { data: allMessages, error: allMessagesError } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', conversationIds)
        .is('deleted_at', null);

      if (allMessagesError) console.warn('Error loading messages for unread count:', allMessagesError);

      // Count unread messages for each conversation
      const unreadCounts = new Map<string, number>();
      conversationsData?.forEach(conv => {
        const participant = participants.find(p => p.conversation_id === conv.id);
        const conversationMessages = allMessages?.filter(m => m.conversation_id === conv.id) || [];
        
        if (!participant?.last_read_at) {
          // If never read, count all messages
          unreadCounts.set(conv.id, conversationMessages.length);
        } else {
          // Count messages created after last_read_at
          const lastReadTime = new Date(participant.last_read_at);
          const unread = conversationMessages.filter(m => 
            new Date(m.created_at) > lastReadTime
          ).length;
          unreadCounts.set(conv.id, unread);
        }
      });
      
      conversationsData?.forEach(conv => {
        const participant = participants.find(p => p.conversation_id === conv.id);
        const lastMessage = lastMessages?.find(m => m.conversation_id === conv.id);
        const convParticipants = allParticipants?.filter(p => p.conversation_id === conv.id) || [];

        // Get unread count from pre-calculated map
        const unreadCount = unreadCounts.get(conv.id) || 0;

        conversationMap.set(conv.id, {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          last_message_at: lastMessage?.created_at || conv.created_at,
          metadata: conv.metadata,
          participants: convParticipants.map(p => ({
            profile_universe_id: p.profile_universe_id,
            is_archived: p.is_archived || false,
            is_muted: p.is_muted || false,
            is_pinned: p.is_pinned || false,
            profile_universe: p.profile_universes
          })),
          last_message: lastMessage ? {
            content: lastMessage.content,
            sender_profile_universe_id: lastMessage.sender_profile_universe_id,
            created_at: lastMessage.created_at
          } : undefined,
          unread_count: unreadCount
        });
      });

      const conversationList = Array.from(conversationMap.values());
      setConversations(conversationList);
      console.log('[RealtimeMessenger] Loaded', conversationList.length, 'conversations');

      // Select conversation from URL if present
      const conversationId = searchParams.get('conversation');
      if (conversationId) {
        const conv = conversationList.find(c => c.id === conversationId);
        if (conv) {
          setSelectedConversation(conv);
          // Hide sidebar on mobile when conversation is selected
          if (window.innerWidth < 768) {
            setShowSidebar(false);
          }
        }
      }
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [universe?.id, user?.id, searchParams]);

  // Optimistically clear state when universe changes (runs before loadConversations)
  const previousUniverseIdRef = useRef<string | undefined>(universe?.id);
  useEffect(() => {
    const currentUniverseId = universe?.id;
    const previousUniverseId = previousUniverseIdRef.current;
    
    // If universe changed (and we had a previous universe), clear state immediately
    if (previousUniverseId && currentUniverseId && previousUniverseId !== currentUniverseId) {
      console.log('[RealtimeMessenger] Universe changed, clearing old data optimistically');
      
      // Clear old data immediately for instant UI update (synchronous state updates)
      setConversations([]);
      setMessages([]);
      setSelectedConversation(null);
      setTypingUsers(new Map());
      setOnlineUsers(new Map());
      setReplyingToMessage(null);
      setSelectedImage(null);
      
      // Set loading states to show we're loading new data
      setIsLoadingConversations(true);
      setIsLoadingMessages(false);
      
      // Clear conversation from URL if present (don't show old conversation)
      const conversationParam = searchParams.get('conversation');
      if (conversationParam) {
        setSearchParams({}, { replace: true });
      }
      
      // Unsubscribe from old conversation channel immediately
      if (conversationChannelRef.current) {
        console.log('[RealtimeMessenger] Unsubscribing from old conversation channel due to universe change');
        supabase.removeChannel(conversationChannelRef.current);
        conversationChannelRef.current = null;
      }
    }
    
    // Update ref for next comparison (always update, even on first render)
    previousUniverseIdRef.current = currentUniverseId;
  }, [universe?.id, searchParams, setSearchParams]);

  // Load conversations on mount and when universe changes
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Note: Auto-focus removed to avoid Radix UI Dialog aria-hidden accessibility conflict
  // Users can click/tab into the input field manually

  // =====================================================
  // SEARCH USERS FOR NEW MESSAGE
  // =====================================================
  const debouncedNewMessageSearch = useDebounce(newMessageSearchQuery, 300);

  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedNewMessageSearch.trim() || !universe?.id) {
        setNewMessageSearchResults([]);
        return;
      }

      setIsSearchingUsers(true);
      try {
        const query = debouncedNewMessageSearch.toLowerCase().trim();
        
        // Search profile_universes by handle or display_name
        const { data, error } = await supabase
          .from('profile_universes')
          .select('id, handle, display_name, avatar_url, role')
          .neq('id', universe.id) // Exclude current user's universe
          .or(`handle.ilike.%${query}%,display_name.ilike.%${query}%`)
          .limit(20);

        if (error) {
          console.error('[RealtimeMessenger] Error searching users:', error);
          toast.error('Failed to search users');
          setNewMessageSearchResults([]);
          return;
        }

        setNewMessageSearchResults(data || []);
      } catch (error: any) {
        console.error('[RealtimeMessenger] Error searching users:', error);
        toast.error('Failed to search users');
        setNewMessageSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    searchUsers();
  }, [debouncedNewMessageSearch, universe?.id]);

  // =====================================================
  // CREATE NEW CONVERSATION
  // =====================================================
  const handleCreateConversation = useCallback(async (targetUniverseId: string) => {
    if (!universe?.id) {
      toast.error('Please select a universe');
      return;
    }

    try {
      setIsNewMessageDialogOpen(false);
      setNewMessageSearchQuery('');
      setNewMessageSearchResults([]);

      // Get or create conversation
      const conversationId = await getOrCreateConversation(universe.id, targetUniverseId);

      // Reload conversations to include the new one
      await loadConversations();

      // Find and select the new conversation
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants:conversation_participants(
            profile_universe_id,
            is_archived,
            is_muted,
            is_pinned,
            profile_universes:profile_universe_id(
              id,
              handle,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('id', conversationId)
        .single();

      if (conversationsData) {
        const participant = conversationsData.conversation_participants?.find(
          (p: any) => p.profile_universe_id === universe.id
        );
        const allParticipants = conversationsData.conversation_participants || [];

        const newConversation: Conversation = {
          id: conversationsData.id,
          type: conversationsData.type,
          name: conversationsData.name,
          last_message_at: conversationsData.created_at,
          metadata: conversationsData.metadata,
          participants: allParticipants.map((p: any) => ({
            profile_universe_id: p.profile_universe_id,
            is_archived: p.is_archived || false,
            is_muted: p.is_muted || false,
            is_pinned: p.is_pinned || false,
            profile_universe: p.profile_universes
          })),
          unread_count: 0
        };

        setSelectedConversation(newConversation);
        setSearchParams({ conversation: conversationId });
        
        // Hide sidebar on mobile
        if (window.innerWidth < 768) {
          setShowSidebar(false);
        }
      }
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error creating conversation:', error);
      toast.error('Failed to create conversation: ' + (error.message || 'Unknown error'));
    }
  }, [universe?.id, loadConversations, setSearchParams]);

  // =====================================================
  // LOAD MESSAGES
  // =====================================================
  const loadMessages = useCallback(async (conversationId: string, currentUniverseId?: string) => {
    const targetUniverseId = currentUniverseId || universe?.id;
    
    if (!conversationId || !targetUniverseId) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    try {
      console.log('[RealtimeMessenger] Loading messages for conversation:', conversationId, 'universe:', targetUniverseId);

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
          read_at,
          metadata,
          attachments,
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
          ),
          reply_to_message:messages!reply_to_message_id(
            id,
            content,
            sender_profile_universe_id,
            profile_universes:sender_profile_universe_id(
              id,
              handle,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      
      // Verify universe hasn't changed while loading
      if (universe?.id !== targetUniverseId) {
        console.log('[RealtimeMessenger] Universe changed during message load, aborting');
        setMessages([]);
        setIsLoadingMessages(false);
        return;
      }

      if (error) {
        console.error('[RealtimeMessenger] Error loading messages:', error);
        toast.error('Failed to load messages');
        setMessages([]);
        return;
      }

      console.log('[RealtimeMessenger] Loaded', data?.length || 0, 'messages');

      // Format messages
      const formattedMessages: Message[] = (data || []).map(m => {
        const senderProfile = Array.isArray(m.profile_universes)
          ? m.profile_universes[0]
          : m.profile_universes;

        // Format reactions
        const reactions = (m.message_reactions || []).map((r: any) => ({
          id: r.id,
          emoji: r.emoji,
          profile_universe_id: r.profile_universe_id,
          created_at: r.created_at,
          profile_universes: Array.isArray(r.profile_universes) ? r.profile_universes[0] : r.profile_universes
        }));

        // Format reply to message
        let replyToMessage = null;
        if (m.reply_to_message) {
          const replyProfile = Array.isArray(m.reply_to_message.profile_universes)
            ? m.reply_to_message.profile_universes[0]
            : m.reply_to_message.profile_universes;
          
          replyToMessage = {
            id: m.reply_to_message.id,
            content: m.reply_to_message.content,
            sender_profile_universe_id: m.reply_to_message.sender_profile_universe_id,
            sender_profile: replyProfile
          };
        }

        return {
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
          read_at: m.read_at,
          metadata: m.metadata || {},
          attachments: m.attachments,
          sender_profile: senderProfile || undefined,
          reactions: reactions,
          reply_to_message: replyToMessage
        };
      });

      setMessages(formattedMessages);

      // Mark messages as read and update read_at for messages
      const now = new Date().toISOString();
      
      // Update conversation participant's last_read_at
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: now })
        .eq('conversation_id', conversationId)
        .eq('profile_universe_id', universe.id);

      // Update read_at for all unread messages in this conversation
      const unreadMessageIds = formattedMessages
        .filter(m => !m.read_at && m.sender_profile_universe_id !== universe.id)
        .map(m => m.id);

      if (unreadMessageIds.length > 0) {
        await supabase
          .from('messages')
          .update({ read_at: now })
          .in('id', unreadMessageIds);
      }
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error loading messages:', error);
      toast.error('Failed to load messages');
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [universe?.id]);

  // Load messages when conversation is selected (only if it belongs to current universe)
  useEffect(() => {
    if (selectedConversation?.id && universe?.id) {
      // Verify the conversation belongs to the current universe
      const isParticipant = selectedConversation.participants.some(
        p => p.profile_universe_id === universe.id
      );
      if (isParticipant) {
        // Pass universe.id to loadMessages to verify it doesn't change during load
        loadMessages(selectedConversation.id, universe.id);
      } else {
        // Conversation doesn't belong to current universe - clear it
        console.log('[RealtimeMessenger] Conversation does not belong to current universe, clearing');
        setSelectedConversation(null);
        setMessages([]);
        setSearchParams({}, { replace: true });
      }
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id, universe?.id, loadMessages, setSearchParams]);

  // =====================================================
  // HANDLE REPLY
  // =====================================================
  const handleReplyToMessage = useCallback((message: Message) => {
    setReplyingToMessage(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingToMessage(null);
  }, []);

  // =====================================================
  // MESSAGE ACTIONS
  // =====================================================
  const handleEditMessage = useCallback((message: Message) => {
    // TODO: Implement message editing UI
    toast.info('Message editing coming soon');
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_profile_universe_id', universe?.id);

      if (error) throw error;

      // Remove from UI
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  }, [universe?.id]);

  const handleForwardMessage = useCallback((message: Message) => {
    // TODO: Implement message forwarding
    toast.info('Message forwarding coming soon');
  }, []);

  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Message copied to clipboard');
    } catch (error) {
      console.error('[RealtimeMessenger] Error copying message:', error);
      toast.error('Failed to copy message');
    }
  }, []);

  // =====================================================
  // MUTE/UNMUTE CONVERSATION
  // =====================================================
  const handleToggleMute = useCallback(async () => {
    if (!selectedConversation || !universe?.id) return;

    const participant = selectedConversation.participants.find(
      p => p.profile_universe_id === universe.id
    );
    const isMuted = participant?.is_muted || false;

    try {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ is_muted: !isMuted })
        .eq('conversation_id', selectedConversation.id)
        .eq('profile_universe_id', universe.id);

      if (error) throw error;

      // Update local state
      setSelectedConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          participants: prev.participants.map(p =>
            p.profile_universe_id === universe.id
              ? { ...p, is_muted: !isMuted }
              : p
          )
        };
      });

      // Reload conversations to update mute status
      loadConversations();

      toast.success(isMuted ? 'Conversation unmuted' : 'Conversation muted');
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error toggling mute:', error);
      toast.error('Failed to update mute status');
    }
  }, [selectedConversation, universe?.id, loadConversations]);

  // =====================================================
  // SEND MESSAGE
  // =====================================================
  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!selectedConversation || !universe?.id || !user?.id) {
      toast.error('Please select a conversation');
      return;
    }

    if (!content.trim() && (!attachments || attachments.length === 0)) {
      return;
    }

    setIsSendingMessage(true);
    try {
      // Upload attachments if any
      let attachmentUrls: any[] = [];
      if (attachments && attachments.length > 0) {
        const uploadPromises = attachments.map(async (file) => {
          try {
            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${universe.id}/${selectedConversation.id}/${fileName}`;

            // Determine content type
            const contentType = file.type || 'application/octet-stream';
            const isImage = contentType.startsWith('image/');
            const isVideo = contentType.startsWith('video/');
            const isAudio = contentType.startsWith('audio/');

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('message-attachments')
              .upload(filePath, file, {
                contentType,
                upsert: false,
                cacheControl: '3600'
              });

            if (uploadError) {
              console.error('[RealtimeMessenger] Upload error:', uploadError);
              throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('message-attachments')
              .getPublicUrl(filePath);

            // Create attachment metadata
            return {
              type: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'file',
              url: publicUrl,
              name: file.name,
              size: file.size,
              mimeType: contentType,
              path: filePath
            };
          } catch (error: any) {
            console.error('[RealtimeMessenger] Error uploading file:', error);
            toast.error(`Failed to upload ${file.name}`);
            throw error;
          }
        });

        attachmentUrls = await Promise.all(uploadPromises);
      }

      // Determine message type based on content and attachments
      let messageType = 'text';
      if (attachmentUrls.length > 0) {
        const hasImage = attachmentUrls.some(a => a.type === 'image');
        const hasVideo = attachmentUrls.some(a => a.type === 'video');
        const hasAudio = attachmentUrls.some(a => a.type === 'audio');
        
        if (hasImage && !hasVideo && !hasAudio) {
          messageType = 'image';
        } else if (hasVideo) {
          messageType = 'video';
        } else if (hasAudio) {
          messageType = 'audio';
        } else {
          messageType = 'file';
        }
      }

      // Create message
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          sender_profile_universe_id: universe.id,
          content: content.trim() || (attachmentUrls.length > 0 ? '📎 Attachment' : ''),
          message_type: messageType,
          attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
          reply_to_message_id: replyingToMessage?.id || null,
          metadata: {}
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

      if (error) throw error;

      // Add to messages list optimistically
      const senderProfile = Array.isArray(newMessage.profile_universes)
        ? newMessage.profile_universes[0]
        : newMessage.profile_universes;

      const formattedMessage: Message = {
        id: newMessage.id,
        conversation_id: newMessage.conversation_id,
        sender_id: newMessage.sender_id,
        sender_profile_universe_id: newMessage.sender_profile_universe_id,
        content: newMessage.content,
        message_type: newMessage.message_type,
        created_at: newMessage.created_at,
        sender_profile: senderProfile
      };

      setMessages(prev => [...prev, formattedMessage]);

      // Clear reply state
      setReplyingToMessage(null);

      // Reload conversations to update last message
      loadConversations();
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedConversation, universe?.id, user?.id, loadConversations, replyingToMessage]);

  // =====================================================
  // PRESENCE TRACKING
  // =====================================================
  useEffect(() => {
    if (!selectedConversation?.id || !universe?.id || !session?.access_token) {
      return;
    }

    // Set up presence channel for online status
    const setupPresence = async () => {
      // Ensure auth is set BEFORE creating channel
      supabase.realtime.setAuth(session.access_token);
      
      // Wait a tick to ensure auth is propagated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const presenceChannel = supabase.channel(`presence:${selectedConversation.id}`, {
      config: {
        presence: {
          key: universe.id
        }
      }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineMap = new Map<string, { universe_id: string; display_name: string; last_seen?: string }>();
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.universe_id && presence.universe_id !== universe.id) {
              onlineMap.set(presence.universe_id, {
                universe_id: presence.universe_id,
                display_name: presence.display_name || 'User',
                last_seen: 'online'
              });
            }
          });
        });
        
        setOnlineUsers(onlineMap);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        newPresences.forEach((presence: any) => {
          if (presence.universe_id && presence.universe_id !== universe.id) {
            setOnlineUsers(prev => new Map(prev).set(presence.universe_id, {
              universe_id: presence.universe_id,
              display_name: presence.display_name || 'User',
              last_seen: 'online'
            }));
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        leftPresences.forEach((presence: any) => {
          if (presence.universe_id && presence.universe_id !== universe.id) {
            setOnlineUsers(prev => {
              const next = new Map(prev);
              next.delete(presence.universe_id);
              return next;
            });
          }
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our own presence
          await presenceChannel.track({
            universe_id: universe.id,
            display_name: universe.display_name || universe.handle,
            online_at: new Date().toISOString()
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeMessenger] Presence channel error - check authentication');
        }
      });

      presenceChannelRef.current = presenceChannel;
    };

    setupPresence();

    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [selectedConversation?.id, universe?.id, session?.access_token]);

  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================
  useEffect(() => {
    if (!selectedConversation?.id || !universe?.id || !session?.access_token) {
      return;
    }

    console.log('[RealtimeMessenger] Setting up Realtime subscription for conversation:', selectedConversation.id);

    // Ensure auth is set BEFORE creating channel
    // This is critical - auth must be set before subscription
    supabase.realtime.setAuth(session.access_token);
    
    // Small delay to ensure auth is propagated to Realtime connection
    // This helps prevent race conditions where channel is created before auth is set
    const setupChannel = async () => {
      // Wait a tick to ensure auth is set
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const channel = supabase
      .channel(`conversation:${selectedConversation.id}:messages`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConversation.id}`
      }, async (payload) => {
        console.log('[RealtimeMessenger] New message received:', payload.new);
        
        // Fetch the full message with sender profile
        const { data: messageData, error } = await supabase
          .from('messages')
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
          .eq('id', payload.new.id)
          .single();

        if (!error && messageData) {
          const senderProfile = Array.isArray(messageData.profile_universes)
            ? messageData.profile_universes[0]
            : messageData.profile_universes;

          const newMessage: Message = {
            id: messageData.id,
            conversation_id: messageData.conversation_id,
            sender_id: messageData.sender_id,
            sender_profile_universe_id: messageData.sender_profile_universe_id,
            content: messageData.content,
            message_type: messageData.message_type,
            created_at: messageData.created_at,
            sender_profile: senderProfile
          };

          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });

          // Update conversation list
          loadConversations();
        }
      })
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions'
      }, async (payload) => {
        // Filter by conversation messages in the handler
        const messageIds = new Set(messages.map(m => m.id));
        const reactionMessageId = payload.new?.message_id || payload.old?.message_id;
        
        if (!reactionMessageId || !messageIds.has(reactionMessageId)) {
          return;
        }
        
        console.log('[RealtimeMessenger] Reaction change:', payload);
        
        // Update reactions optimistically
        if (payload.eventType === 'INSERT' && payload.new) {
          // Fetch the reaction with profile data
          // Use separate queries to avoid PostgREST nested query issues
          const { data: reactionData, error: reactionError } = await supabase
            .from('message_reactions')
            .select('id, emoji, profile_universe_id, created_at')
            .eq('id', payload.new.id)
            .single();

          if (reactionError || !reactionData) {
            console.error('[RealtimeMessenger] Error fetching reaction:', reactionError);
            return;
          }

          // Fetch profile data separately
          const { data: profileData } = await supabase
            .from('profile_universes')
            .select('id, handle, display_name, avatar_url')
            .eq('id', reactionData.profile_universe_id)
            .single();

          const reactionDataWithProfile = {
            ...reactionData,
            profile_universes: profileData
          };

          if (reactionDataWithProfile) {
            setMessages(prev => prev.map(msg => {
              if (msg.id === payload.new.message_id) {
                const existing = msg.reactions || [];
                // Check if reaction already exists (avoid duplicates)
                if (!existing.some((r: any) => r.id === reactionDataWithProfile.id)) {
                  return {
                    ...msg,
                    reactions: [...existing, {
                      id: reactionDataWithProfile.id,
                      emoji: reactionDataWithProfile.emoji,
                      profile_universe_id: reactionDataWithProfile.profile_universe_id,
                      created_at: reactionDataWithProfile.created_at,
                      profile_universes: reactionDataWithProfile.profile_universes
                    }]
                  };
                }
              }
              return msg;
            }));
          }
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setMessages(prev => prev.map(msg => {
            if (msg.id === payload.old.message_id) {
              return {
                ...msg,
                reactions: (msg.reactions || []).filter((r: any) => r.id !== payload.old.id)
              };
            }
            return msg;
          }));
        }
      })
      .subscribe((status) => {
        console.log('[RealtimeMessenger] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeMessenger] Successfully subscribed to conversation channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeMessenger] Channel error - check authentication');
          // Try to re-authenticate and resubscribe
          if (session?.access_token) {
            console.log('[RealtimeMessenger] Retrying with fresh auth token');
            supabase.realtime.setAuth(session.access_token);
          }
        } else if (status === 'TIMED_OUT') {
          console.error('[RealtimeMessenger] Channel timed out');
        } else if (status === 'CLOSED') {
          console.log('[RealtimeMessenger] Channel closed');
        }
      });

      conversationChannelRef.current = channel;
    };

    setupChannel();

    return () => {
      console.log('[RealtimeMessenger] Unsubscribing from conversation channel');
      if (conversationChannelRef.current) {
        conversationChannelRef.current.unsubscribe();
        conversationChannelRef.current = null;
      }
    };
  }, [selectedConversation?.id, universe?.id, session?.access_token, loadConversations, messages]);

  // =====================================================
  // MESSAGE REACTIONS
  // =====================================================
  const handleAddReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!universe?.id) return;

    // Check if user already reacted with this emoji
    const message = messages.find(m => m.id === messageId);
    const existingReaction = message?.reactions?.find(
      (r: any) => r.profile_universe_id === universe.id && r.emoji === emoji
    );

    const isRemoving = !!existingReaction;
    const tempReactionId = `temp-reaction-${Date.now()}`;

    // Optimistic update
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const currentReactions = msg.reactions || [];
      
      if (isRemoving) {
        return {
          ...msg,
          reactions: currentReactions.filter((r: any) => r.id !== existingReaction.id)
        };
      } else {
        const newReaction = {
          id: tempReactionId,
          emoji,
          profile_universe_id: universe.id,
          created_at: new Date().toISOString(),
          profile_universes: {
            id: universe.id,
            handle: universe.handle,
            display_name: universe.display_name || universe.handle
          }
        };
        return {
          ...msg,
          reactions: [...currentReactions, newReaction]
        };
      }
    }));

    try {
      if (isRemoving) {
        // Remove reaction
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;
      } else {
        // Add reaction
        const { data: reactionData, error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            profile_universe_id: universe.id,
            emoji: emoji
          })
          .select('id, emoji, profile_universe_id, created_at')
          .single();

        if (error) throw error;

        // Fetch profile data separately
        let profileData = null;
        if (reactionData) {
          const { data: profile } = await supabase
            .from('profile_universes')
            .select('id, handle, display_name, avatar_url')
            .eq('id', reactionData.profile_universe_id)
            .single();
          profileData = profile;
        }

        // Replace temp reaction with real one
        if (reactionData) {
          setMessages(prev => prev.map(msg => {
            if (msg.id !== messageId) return msg;
            const currentReactions = msg.reactions || [];
            return {
              ...msg,
              reactions: currentReactions.map((r: any) => 
                r.id === tempReactionId ? {
                  id: reactionData.id,
                  emoji: reactionData.emoji,
                  profile_universe_id: reactionData.profile_universe_id,
                  created_at: reactionData.created_at,
                  profile_universes: profileData
                } : r
              )
            };
          }));
        }
      }
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error handling reaction:', error);
      toast.error('Failed to update reaction');
      // Revert optimistic update on error
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg;
        const currentReactions = msg.reactions || [];
        
        if (isRemoving) {
          return {
            ...msg,
            reactions: [...currentReactions, existingReaction]
          };
        } else {
          return {
            ...msg,
            reactions: currentReactions.filter((r: any) => r.id !== tempReactionId)
          };
        }
      }));
    }
  }, [universe?.id, messages]);

  // =====================================================
  // HANDLERS
  // =====================================================
  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation);
    setSearchParams({ conversation: conversation.id });
    // Hide sidebar on mobile when conversation is selected
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, [setSearchParams]);
  
  const handleBackToConversations = useCallback(() => {
    setSelectedConversation(null);
    setSearchParams({});
    setShowSidebar(true);
    setShowRightSidebar(false);
  }, [setSearchParams]);

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
  // EARLY RETURNS
  // =====================================================
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to use the messenger</p>
        </div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please select a universe to use the messenger</p>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================
  return (
    <>
      {/* Navigation Header - Standalone Messenger */}
      <div className="border-b border-dv-gray-200 dark:border-dv-gray-800 bg-dv-gray-50/95 dark:bg-dv-gray-950/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-full mx-auto px-dv-4 py-dv-3 flex items-center justify-between">
          <div className="flex items-center gap-dv-2">
            <img 
              src="/dragvertising-logo.png" 
              alt="Dragvertising Messenger" 
              className="h-dv-6 w-auto"
            />
            <span className="text-dv-sm font-dv-semibold text-muted-foreground hidden sm:inline">
              Messenger
            </span>
          </div>
          
          {/* Right Side Navigation */}
          <div className="flex items-center gap-2">
            {/* Mobile menu button to show sidebar */}
            {!showSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(true)}
                className="h-9 w-9 md:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            
            {/* Universe Switcher */}
            <div className="flex items-center">
              <Suspense fallback={<Button variant="ghost" size="icon" className="h-9 w-9" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>}>
                <UniverseSwitcher />
              </Suspense>
            </div>
            
            {/* Sign out button */}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success('Signed out');
                }}
                className="text-dv-sm"
              >
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)] bg-dv-gray-50 dark:bg-dv-gray-950 relative overflow-hidden w-full">
        {/* Mobile Overlay */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black/50 z-10 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
        
        {/* Conversation List Sidebar */}
        <div className={cn(
          "flex-shrink-0 border-r border-dv-gray-200 dark:border-dv-gray-800 bg-background transition-all duration-300 ease-in-out",
          "w-full sm:w-80 md:w-96",
          "absolute md:relative inset-0 z-20 md:z-auto",
          "overflow-hidden",
          showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isSidebarCollapsed && "md:w-16"
        )}>
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id}
            onSelectConversation={handleSelectConversation}
            onNewMessage={() => setIsNewMessageDialogOpen(true)}
            currentUniverseId={universe.id}
            searchQuery={conversationSearchQuery}
            onSearchChange={setConversationSearchQuery}
            filter={conversationFilter}
            onFilterChange={setConversationFilter}
            isLoading={isLoadingConversations}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            showSidebar={showSidebar}
            onCloseSidebar={() => setShowSidebar(false)}
          />
        </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-dv-16 border-b border-border px-dv-4 flex items-center justify-between bg-background">
              <div className="flex items-center gap-dv-3 min-w-0">
                {/* Mobile menu/back button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      setShowSidebar(true);
                    } else {
                      handleBackToConversations();
                    }
                  }}
                  className="h-9 w-9 md:hidden flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="relative">
                  <Avatar className="h-dv-10 w-dv-10 flex-shrink-0">
                    <AvatarImage src={selectedConversation.participants.find(p => p.profile_universe_id !== universe.id)?.profile_universe?.avatar_url} />
                    <AvatarFallback>
                      {selectedConversation.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {selectedConversation.participants
                    .filter(p => p.profile_universe_id !== universe.id)
                    .some(p => onlineUsers.has(p.profile_universe_id)) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-dv-semibold text-dv-base truncate">
                    {selectedConversation.name || 
                     selectedConversation.participants
                       .filter(p => p.profile_universe_id !== universe.id)
                       .map(p => p.profile_universe?.display_name || p.profile_universe?.handle)
                       .join(', ') || 
                     'Conversation'}
                  </h3>
                  {selectedConversation.participants
                    .filter(p => p.profile_universe_id !== universe.id)
                    .some(p => onlineUsers.has(p.profile_universe_id)) ? (
                    <p className="text-dv-xs text-muted-foreground">Active now</p>
                  ) : selectedConversation.participants
                    .filter(p => p.profile_universe_id !== universe.id)
                    .length > 0 ? (
                    <p className="text-dv-xs text-muted-foreground">Offline</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-dv-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="Search messages"
                  onClick={() => setShowMessageSearch(!showMessageSearch)}
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title={selectedConversation.participants.find(p => p.profile_universe_id === universe.id)?.is_muted ? 'Unmute conversation' : 'Mute conversation'}
                  onClick={handleToggleMute}
                >
                  {selectedConversation.participants.find(p => p.profile_universe_id === universe.id)?.is_muted ? (
                    <Bell className="h-4 w-4" />
                  ) : (
                    <BellOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="Video call"
                  onClick={() => {
                    console.log('[RealtimeMessenger] Video button clicked', {
                      selectedConversation: selectedConversation?.id,
                      participants: selectedConversation?.participants,
                      participantsCount: selectedConversation?.participants?.length,
                      universeId: universe?.id,
                      isVideoCallOpen: isVideoCallOpen
                    });
                    if (!selectedConversation) {
                      console.warn('[RealtimeMessenger] Cannot start video call: No conversation selected');
                      toast.error('Please select a conversation first');
                      return;
                    }
                    const otherParticipant = selectedConversation.participants.find(
                      p => p.profile_universe_id !== universe.id
                    );
                    if (!otherParticipant) {
                      console.warn('[RealtimeMessenger] Cannot start video call: No other participant found');
                      toast.error('Cannot start video call: Participant not found');
                      return;
                    }
                    setIsVideoCallOpen(true);
                  }}
                  disabled={!selectedConversation}
                >
                  <Video className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <MessageArea
              messages={messages}
              currentUniverseId={universe.id}
              isLoading={isLoadingMessages}
              selectedConversationName={selectedConversation.name}
              typingUsers={Array.from(typingUsers.values())}
              onAddReaction={handleAddReaction}
              onReplyToMessage={handleReplyToMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onForwardMessage={handleForwardMessage}
              onCopyMessage={handleCopyMessage}
              onImageClick={(url, name) => setSelectedImage({ url, name })}
            />

            {/* Message Search Bar */}
            {showMessageSearch && (
              <div className="border-b border-border px-4 py-2 bg-muted/50">
                <Input
                  placeholder="Search messages..."
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
            )}

            {/* Message Input */}
            <div className="relative">
              {replyingToMessage && (
                <div className="border-t border-border bg-muted/50 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-0.5 h-8 bg-primary rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        Replying to {replyingToMessage.sender_profile?.display_name || 'message'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {replyingToMessage.content}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={handleCancelReply}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <MessageInput
                onSendMessage={sendMessage}
                onTyping={handleTyping}
                isSending={isSendingMessage}
                placeholder={`Message ${selectedConversation.name || 'conversation'}...`}
              />
              {/* Voice Message Button */}
              {selectedConversation && (
                <div className="absolute bottom-16 right-4">
                  <Suspense fallback={null}>
                    <VoiceMessageButton
                      conversationId={selectedConversation.id}
                      universeId={universe.id}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Select a conversation to start messaging</p>
              <Button onClick={() => setIsNewMessageDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Start New Conversation
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* New Message Dialog */}
      <Dialog open={isNewMessageDialogOpen} onOpenChange={(open) => {
        setIsNewMessageDialogOpen(open);
        if (!open) {
          setNewMessageSearchQuery('');
          setNewMessageSearchResults([]);
        }
      }}>
        <DialogContent 
          className="max-w-md"
          onOpenAutoFocus={(e) => {
            // Prevent default auto-focus to avoid Radix UI Dialog aria-hidden accessibility conflict
            // This is a known issue: https://github.com/radix-ui/primitives/issues/3593
            // Users can manually click/tab into the input field
            e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or handle..."
                value={newMessageSearchQuery}
                onChange={(e) => setNewMessageSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {isSearchingUsers && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearchingUsers && newMessageSearchQuery.trim() && newMessageSearchResults.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No users found matching "{newMessageSearchQuery}"
              </div>
            )}

            {!isSearchingUsers && newMessageSearchResults.length > 0 && (
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {newMessageSearchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleCreateConversation(user.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>
                        {user.display_name?.charAt(0) || user.handle?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user.display_name || user.handle || 'Unknown User'}
                      </p>
                      {user.display_name && user.handle && (
                        <p className="text-xs text-muted-foreground truncate">
                          @{user.handle}
                        </p>
                      )}
                      {user.role && (
                        <p className="text-xs text-muted-foreground capitalize">
                          {user.role.replace('_', ' ')}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!newMessageSearchQuery.trim() && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Start typing to search for users...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call Dialog */}
      {selectedConversation && (() => {
        const otherParticipantData = selectedConversation.participants.find(
          p => p.profile_universe_id !== universe.id
        );
        if (!otherParticipantData) return null;
        
        return (
          <Suspense fallback={null}>
            <VideoCallDialog
              isOpen={isVideoCallOpen}
              onClose={() => setIsVideoCallOpen(false)}
              conversationId={selectedConversation.id}
              otherParticipant={{
                profile_universe_id: otherParticipantData.profile_universe_id,
                profile_universe: otherParticipantData.profile_universe
              }}
              incomingCall={incomingCall}
            />
          </Suspense>
        );
      })()}

      {/* Image Lightbox */}
      {selectedImage && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent 
            className="max-w-[95vw] w-full max-h-[95vh] p-0 bg-transparent border-none shadow-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="relative w-full h-full min-h-[400px] flex items-center justify-center bg-black/95 rounded-lg overflow-hidden">
              <img
                src={selectedImage.url}
                alt={selectedImage.name || 'Image'}
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                onError={(e) => {
                  console.error('[RealtimeMessenger] Error loading image:', selectedImage.url);
                  toast.error('Failed to load image');
                  setSelectedImage(null);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/70 hover:bg-black/90 text-white z-10"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
              {selectedImage.name && (
                <div className="absolute bottom-4 left-4 right-4 text-center z-10 pointer-events-none">
                  <p className="text-sm text-white/90 bg-black/70 px-4 py-2 rounded-lg inline-block backdrop-blur-sm pointer-events-auto">
                    {selectedImage.name}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
