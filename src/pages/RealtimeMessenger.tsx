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
import { Loader2, UserPlus, X, ExternalLink, Menu, Video, Search } from 'lucide-react';
import { toast } from '@/hooks/shared/use-toast';
import { cn } from '@/lib/utils';

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
  
  // Mobile responsive state
  const [showSidebar, setShowSidebar] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  
  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<Map<string, { user_id: string; display_name: string; timestamp: number }>>(new Map());
  
  // Message search
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  
  // Video call
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);

  // Refs
  const conversationChannelRef = useRef<RealtimeChannel | null>(null);
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

      // Build conversation list
      const conversationMap = new Map<string, Conversation>();
      
      conversationsData?.forEach(conv => {
        const participant = participants.find(p => p.conversation_id === conv.id);
        const lastMessage = lastMessages?.find(m => m.conversation_id === conv.id);
        const convParticipants = allParticipants?.filter(p => p.conversation_id === conv.id) || [];

        // Count unread messages
        const unreadCount = lastMessage && participant?.last_read_at
          ? new Date(lastMessage.created_at) > new Date(participant.last_read_at) ? 1 : 0
          : 0;

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

  // Load conversations on mount and when universe changes
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // =====================================================
  // LOAD MESSAGES
  // =====================================================
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId || !universe?.id) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    try {
      console.log('[RealtimeMessenger] Loading messages for conversation:', conversationId);

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
          )
        `)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

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
          reactions: m.message_reactions || []
        };
      });

      setMessages(formattedMessages);

      // Mark messages as read
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('profile_universe_id', universe.id);
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error loading messages:', error);
      toast.error('Failed to load messages');
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [universe?.id]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation?.id) {
      loadMessages(selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id, loadMessages]);

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
        // TODO: Implement file upload to Supabase Storage
        console.log('[RealtimeMessenger] File upload not yet implemented');
      }

      // Create message
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          sender_profile_universe_id: universe.id,
          content: content.trim(),
          message_type: 'text',
          attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
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

      // Reload conversations to update last message
      loadConversations();
    } catch (error: any) {
      console.error('[RealtimeMessenger] Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedConversation, universe?.id, user?.id, loadConversations]);

  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================
  useEffect(() => {
    if (!selectedConversation?.id || !universe?.id || !session?.access_token) {
      return;
    }

    console.log('[RealtimeMessenger] Setting up Realtime subscription for conversation:', selectedConversation.id);

    // Ensure auth is set
    supabase.realtime.setAuth(session.access_token);

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
      .subscribe((status) => {
        console.log('[RealtimeMessenger] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeMessenger] Successfully subscribed to conversation channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeMessenger] Channel error - check authentication');
        }
      });

    conversationChannelRef.current = channel;

    return () => {
      console.log('[RealtimeMessenger] Unsubscribing from conversation channel');
      channel.unsubscribe();
      conversationChannelRef.current = null;
    };
  }, [selectedConversation?.id, universe?.id, session?.access_token, loadConversations]);

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
      {/* Navigation Header */}
      <div className="border-b bg-card/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <a
            href={(import.meta.env.VITE_MAIN_APP_URL || (import.meta.env.DEV ? 'http://localhost:3000' : 'https://dragvertising.app')).replace(/\/$/, '')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
            aria-label="Go to Dragvertising main app"
          >
            <img 
              src="/dragvertising-logo.png" 
              alt="Dragvertising" 
              className="h-6 w-auto group-hover:scale-105 transition-transform"
            />
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          
          {/* Right Side Navigation */}
          <div className="flex items-center gap-2">
            {/* Mobile menu button to show sidebar */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(true)}
              className="h-9 w-9 md:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
            
            {/* Universe Switcher */}
            <div className="flex items-center">
              <Suspense fallback={<Button variant="ghost" size="icon" className="h-9 w-9" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>}>
                <UniverseSwitcher />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)] bg-background relative overflow-hidden">
        {/* Mobile Overlay */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black/50 z-10 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
        
        {/* Conversation List Sidebar */}
        <div className={cn(
          "flex-shrink-0 border-r border-border bg-background transition-all duration-300 ease-in-out",
          "w-full sm:w-80 md:w-96",
          "absolute md:relative inset-0 z-20 md:z-auto",
          "min-w-0 max-w-full overflow-hidden",
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
      <div className="flex-1 flex flex-col min-w-0">
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
                <Avatar className="h-dv-10 w-dv-10 flex-shrink-0">
                  <AvatarImage src={selectedConversation.participants.find(p => p.profile_universe_id !== universe.id)?.profile_universe?.avatar_url} />
                  <AvatarFallback>
                    {selectedConversation.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-dv-semibold text-dv-base truncate">
                    {selectedConversation.name || 
                     selectedConversation.participants
                       .filter(p => p.profile_universe_id !== universe.id)
                       .map(p => p.profile_universe?.display_name || p.profile_universe?.handle)
                       .join(', ') || 
                     'Conversation'}
                  </h3>
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
                  title="Video call"
                  onClick={() => setIsVideoCallOpen(true)}
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
      <Dialog open={isNewMessageDialogOpen} onOpenChange={setIsNewMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search users..."
              value={newMessageSearchQuery}
              onChange={(e) => setNewMessageSearchQuery(e.target.value)}
            />
            <div className="text-sm text-muted-foreground">
              New message functionality coming soon...
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call Dialog */}
      {selectedConversation && (
        <Suspense fallback={null}>
          <VideoCallDialog
            isOpen={isVideoCallOpen}
            onClose={() => setIsVideoCallOpen(false)}
            conversationId={selectedConversation.id}
            otherParticipant={selectedConversation.participants.find(p => p.profile_universe_id !== universe.id)?.profile_universe}
          />
        </Suspense>
      )}
    </>
  );
}
