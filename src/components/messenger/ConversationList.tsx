import React from 'react';
import { ScrollArea, Avatar, AvatarFallback, AvatarImage, Badge, Input, Button } from '@/lib/design-system';
import { MessageSquare, Search, UserPlus, Archive, Pin, Bell, BellOff, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  type: string;
  name?: string;
  last_message_at?: string;
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

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  onNewMessage: () => void;
  currentUniverseId?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: 'all' | 'unread' | 'pinned' | 'archived';
  onFilterChange: (filter: 'all' | 'unread' | 'pinned' | 'archived') => void;
  isLoading?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  showSidebar?: boolean;
  onCloseSidebar?: () => void;
}

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onNewMessage,
  currentUniverseId,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  isLoading = false,
  isCollapsed = false,
  onToggleCollapse,
  showSidebar = true,
  onCloseSidebar
}: ConversationListProps) {
  // Filter conversations based on active filter
  const filteredConversations = React.useMemo(() => {
    let filtered = conversations;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => {
        const participantNames = conv.participants
          .filter(p => p.profile_universe_id !== currentUniverseId)
          .map(p => p.profile_universe?.display_name || p.profile_universe?.handle || '')
          .join(' ')
          .toLowerCase();
        
        return (
          participantNames.includes(query) ||
          conv.name?.toLowerCase().includes(query) ||
          conv.last_message?.content.toLowerCase().includes(query)
        );
      });
    }

    // Apply filter tabs
    switch (filter) {
      case 'unread':
        filtered = filtered.filter(c => c.unread_count > 0);
        break;
      case 'pinned':
        filtered = filtered.filter(c => 
          c.participants.some(p => p.profile_universe_id === currentUniverseId && p.is_pinned)
        );
        break;
      case 'archived':
        filtered = filtered.filter(c => 
          c.participants.some(p => p.profile_universe_id === currentUniverseId && p.is_archived)
        );
        break;
    }

    // Sort by last message time or pinned status
    return filtered.sort((a, b) => {
      const aPinned = a.participants.some(p => p.profile_universe_id === currentUniverseId && p.is_pinned);
      const bPinned = b.participants.some(p => p.profile_universe_id === currentUniverseId && p.is_pinned);
      
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, searchQuery, filter, currentUniverseId]);

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    const otherParticipants = conv.participants.filter(p => p.profile_universe_id !== currentUniverseId);
    if (otherParticipants.length === 0) return 'You';
    if (otherParticipants.length === 1) {
      return otherParticipants[0].profile_universe?.display_name || otherParticipants[0].profile_universe?.handle || 'Unknown';
    }
    return `${otherParticipants.length} participants`;
  };

  const getConversationAvatar = (conv: Conversation) => {
    const otherParticipants = conv.participants.filter(p => p.profile_universe_id !== currentUniverseId);
    if (otherParticipants.length > 0) {
      return otherParticipants[0].profile_universe?.avatar_url;
    }
    return undefined;
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full bg-background border-r border-border w-16 items-center py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 mb-2"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewMessage}
          className="h-8 w-8"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background border-r border-border w-full sm:w-80 md:w-96">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            {/* Mobile close button */}
            {onCloseSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseSidebar}
                className="h-8 w-8 md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-dv-lg md:text-dv-xl font-dv-semibold">Messages</h2>
              <p className="text-dv-xs md:text-dv-sm text-muted-foreground mt-dv-0.5">
                {filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewMessage}
              className="h-8 w-8 md:h-9 md:w-9"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="h-8 w-8 md:h-9 md:w-9 hidden md:flex"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-border px-2">
          {(['all', 'unread', 'pinned', 'archived'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onFilterChange(tab)}
              className={cn(
                "px-dv-4 py-dv-2 text-dv-sm font-dv-semibold border-b-2 transition-dv-base",
                filter === tab
                  ? "border-dv-pink-500 text-dv-pink-500"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-muted-foreground">Loading conversations...</div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground text-center">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <Button
                variant="default"
                size="sm"
                onClick={onNewMessage}
                className="mt-4"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {filteredConversations.map((conversation) => {
              const isSelected = conversation.id === selectedConversationId;
              const participant = conversation.participants.find(
                p => p.profile_universe_id === currentUniverseId
              );
              const isMuted = participant?.is_muted || false;
              const isPinned = participant?.is_pinned || false;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(conversation)}
                  className={cn(
                    "w-full p-dv-3 rounded-dv-lg text-left transition-dv-base mb-dv-1",
                    "hover:bg-accent overflow-hidden",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar className="h-dv-12 w-dv-12 flex-shrink-0">
                      <AvatarImage src={getConversationAvatar(conversation)} />
                      <AvatarFallback>
                        {getConversationDisplayName(conversation).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between mb-dv-1 gap-2 min-w-0">
                        <div className="flex items-center gap-dv-2 min-w-0 flex-1">
                          <span className="font-dv-semibold text-dv-sm truncate">
                            {getConversationDisplayName(conversation)}
                          </span>
                          {isPinned && <Pin className="h-dv-3 w-dv-3 text-muted-foreground flex-shrink-0" />}
                          {isMuted && <BellOff className="h-dv-3 w-dv-3 text-muted-foreground flex-shrink-0" />}
                        </div>
                        {conversation.last_message_at && (
                          <span className="text-dv-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                            {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-dv-2 min-w-0">
                        <p className="text-dv-sm text-muted-foreground truncate flex-1 min-w-0">
                          {conversation.last_message?.content || 'No messages yet'}
                        </p>
                        {conversation.unread_count > 0 && (
                          <Badge variant="default" className="flex-shrink-0 bg-dv-pink-500">
                            {conversation.unread_count}
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
  );
}


