import React, { useEffect, useRef, useState } from 'react';
import { ScrollArea, Avatar, AvatarFallback, AvatarImage, Popover, PopoverContent, PopoverTrigger, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/lib/design-system';
import { Loader2, MessageSquare, Smile, CornerUpLeft, Copy, Trash2, Forward, Edit, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { EmojiPicker } from '@/components/shared/EmojiPicker';

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

interface TypingUser {
  user_id: string;
  display_name: string;
  timestamp: number;
}

interface MessageAreaProps {
  messages: Message[];
  currentUniverseId?: string;
  isLoading?: boolean;
  selectedConversationName?: string;
  typingUsers?: TypingUser[];
  onAddReaction?: (messageId: string, emoji: string) => void;
  onReplyToMessage?: (message: Message) => void;
  onEditMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onForwardMessage?: (message: Message) => void;
  onCopyMessage?: (content: string) => void;
  onImageClick?: (url: string, name?: string) => void;
}

export function MessageArea({
  messages,
  currentUniverseId,
  isLoading = false,
  selectedConversationName,
  typingUsers = [],
  onAddReaction,
  onReplyToMessage,
  onEditMessage,
  onDeleteMessage,
  onForwardMessage,
  onCopyMessage,
  onImageClick
}: MessageAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          {selectedConversationName 
            ? `No messages yet. Start the conversation with ${selectedConversationName}!`
            : 'No messages yet. Start the conversation!'
          }
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full w-full overflow-hidden" ref={scrollAreaRef}>
      <div className="p-4 md:p-6 space-y-4 w-full max-w-full">
        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const isMe = message.sender_profile_universe_id === currentUniverseId;
          const showAvatar = !prevMessage || prevMessage.sender_profile_universe_id !== message.sender_profile_universe_id;
          const showTime = !prevMessage ||
            (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) > 300000; // 5 minutes

          return (
            <div key={message.id}>
              {showTime && (
                <div className="flex items-center justify-center my-4">
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
                      "rounded-dv-2xl px-dv-4 py-dv-2.5 shadow-dv-sm transition-dv-base relative",
                      "group-hover:shadow-dv-md",
                      isMe
                        ? "bg-dv-pink-500 text-white rounded-br-dv-md"
                        : "bg-card border border-border rounded-bl-dv-md"
                    )}
                  >
                    {/* Reply Preview */}
                    {message.reply_to_message_id && message.reply_to_message && (
                      <div className={cn(
                        "mb-2 pb-2 border-l-2 pl-2 text-xs opacity-70",
                        isMe ? "border-primary-foreground/30" : "border-border"
                      )}>
                        <p className="font-medium">
                          Replying to {message.reply_to_message.sender_profile?.display_name || 'message'}
                        </p>
                        <p className="truncate">{message.reply_to_message.content}</p>
                      </div>
                    )}

                    {/* Message Content */}
                    <p className="text-dv-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((attachment: any, idx: number) => (
                          <div key={idx} className="rounded-lg overflow-hidden">
                            {attachment.type?.startsWith('image/') ? (
                              <img
                                src={attachment.url}
                                alt={attachment.name || 'Attachment'}
                                className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => onImageClick?.(attachment.url, attachment.name)}
                              />
                            ) : (
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80"
                              >
                                <span className="text-sm">{attachment.name || 'File'}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message Reactions */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(
                            message.reactions.reduce((acc: any, reaction: any) => {
                              const emoji = reaction.emoji;
                              if (!acc[emoji]) {
                                acc[emoji] = [];
                              }
                              acc[emoji].push(reaction);
                              return acc;
                            }, {})
                          ).map(([emoji, reactions]: [string, any]) => {
                            const hasUserReaction = reactions.some((r: any) => r.profile_universe_id === currentUniverseId);
                            return (
                              <button
                                key={emoji}
                                onClick={() => onAddReaction?.(message.id, emoji)}
                                className={cn(
                                  "px-2 py-1 rounded-full text-xs flex items-center gap-1",
                                  "bg-muted hover:bg-muted/80 transition-colors cursor-pointer",
                                  hasUserReaction && "ring-2 ring-primary",
                                  isMe ? "bg-primary/20" : "bg-muted"
                                )}
                                title={reactions.map((r: any) => r.profile_universes?.display_name || 'User').join(', ')}
                              >
                                <span>{emoji}</span>
                                <span className="text-muted-foreground">{reactions.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Add Reaction Button */}
                      {onAddReaction && (
                        <EmojiPicker
                          onEmojiSelect={(emoji) => {
                            onAddReaction(message.id, emoji);
                          }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
                                isMe ? "text-white/70 hover:text-white" : "text-muted-foreground"
                              )}
                              title="Add reaction"
                            >
                              <Smile className="h-3 w-3" />
                            </Button>
                          }
                        />
                      )}
                    </div>

                    {/* Timestamp and Read Receipt */}
                    <div className={cn(
                      "mt-dv-1 flex items-center gap-1 text-dv-xs opacity-70",
                      isMe ? "text-white/70" : "text-muted-foreground"
                    )}>
                      <span>
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        {message.edited_at && ' (edited)'}
                      </span>
                      {isMe && message.read_at && (
                        <span className="ml-1" title="Read">
                          ✓✓
                        </span>
                      )}
                      {isMe && !message.read_at && (
                        <span className="ml-1" title="Sent">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Message Actions */}
                  <div className={cn(
                    "absolute opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1",
                    isMe ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"
                  )}>
                    {onReplyToMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onReplyToMessage(message)}
                        title="Reply"
                      >
                        <CornerUpLeft className="h-3 w-3 mr-1" />
                        Reply
                      </Button>
                    )}
                    
                    {/* Context Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="More options"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMe ? "end" : "start"}>
                        {onCopyMessage && (
                          <DropdownMenuItem onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onCopyMessage(message.content);
                          }}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </DropdownMenuItem>
                        )}
                        {onReplyToMessage && (
                          <DropdownMenuItem onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onReplyToMessage(message);
                          }}>
                            <CornerUpLeft className="h-4 w-4 mr-2" />
                            Reply
                          </DropdownMenuItem>
                        )}
                        {onForwardMessage && (
                          <DropdownMenuItem onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onForwardMessage(message);
                          }}>
                            <Forward className="h-4 w-4 mr-2" />
                            Forward
                          </DropdownMenuItem>
                        )}
                        {isMe && onEditMessage && !message.deleted_at && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onEditMessage(message);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          </>
                        )}
                        {isMe && onDeleteMessage && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDeleteMessage(message.id);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted-foreground">
              {typingUsers.map(u => u.display_name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}





