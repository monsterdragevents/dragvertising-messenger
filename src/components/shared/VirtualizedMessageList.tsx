import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect, useMemo } from 'react';

interface Message {
  id: string;
  content: string;
  created_at: string;
  [key: string]: any;
}

interface VirtualizedMessageListProps {
  messages: Message[];
  renderMessage: (message: Message, index: number) => React.ReactNode;
  onScrollToBottom?: () => void;
  autoScroll?: boolean;
}

export function VirtualizedMessageList({ 
  messages, 
  renderMessage,
  onScrollToBottom,
  autoScroll = true
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Estimate based on message content length
      const msg = messages[index];
      if (!msg) return 80;
      
      const baseHeight = 60;
      const contentLength = msg.content?.length || 0;
      const hasAttachments = msg.attachments && msg.attachments.length > 0;
      const hasReactions = msg.reactions && msg.reactions.length > 0;
      const hasReply = !!msg.reply_to_message;
      
      // Rough estimation: ~20px per 50 characters, min 40px, max 300px
      const contentHeight = Math.max(40, Math.min(300, Math.ceil(contentLength / 50) * 20));
      
      // Add extra height for attachments, reactions, replies
      let extraHeight = 0;
      if (hasAttachments) extraHeight += 120;
      if (hasReactions) extraHeight += 30;
      if (hasReply) extraHeight += 50;
      
      return Math.min(baseHeight + contentHeight + extraHeight, 500);
    },
    overscan: 5,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messages.length > 0 && parentRef.current) {
      const scrollElement = parentRef.current;
      const isNearBottom = 
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 100;
      
      if (isNearBottom) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
          onScrollToBottom?.();
        }, 50);
      }
    }
  }, [messages.length, virtualizer, autoScroll, onScrollToBottom]);

  // Scroll to bottom on mount if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      setTimeout(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      }, 100);
    }
  }, []); // Only on mount

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="h-full overflow-auto" style={{ contain: 'strict' }}>
      <div 
        style={{ 
          height: `${virtualizer.getTotalSize()}px`, 
          position: 'relative',
          width: '100%'
        }}
      >
        {virtualItems.map((virtualItem) => {
          const message = messages[virtualItem.index];
          if (!message) return null;
          
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderMessage(message, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
