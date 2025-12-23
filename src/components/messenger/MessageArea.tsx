import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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

interface MessageAreaProps {
  messages: Message[];
  currentUniverseId?: string;
  isLoading?: boolean;
  selectedConversationName?: string;
}

export function MessageArea({
  messages,
  currentUniverseId,
  isLoading = false,
  selectedConversationName
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
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
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
    <ScrollArea className="flex-1 h-full" ref={scrollAreaRef}>
      <div className="p-4 md:p-6 space-y-4">
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
                      "rounded-2xl px-4 py-2.5 shadow-sm transition-all relative",
                      "group-hover:shadow-md",
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border rounded-bl-md"
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
                    <p className="text-sm whitespace-pre-wrap break-words">
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
                                className="max-w-full h-auto rounded-lg"
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

                    {/* Timestamp */}
                    <div className={cn(
                      "mt-1 text-xs opacity-70",
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      {message.edited_at && ' (edited)'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
