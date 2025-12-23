import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from './useDebounce';

interface MessageSearchResult {
  id: string;
  conversation_id: string;
  sender_profile_universe_id: string;
  content: string;
  message_type: string;
  created_at: string;
  profile_universes?: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
  };
}

export function useMessageSearch(conversationId: string | null) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const search = useCallback(async (query: string) => {
    if (!query.trim() || !conversationId) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_profile_universe_id,
          content,
          message_type,
          created_at,
          profile_universes:sender_profile_universe_id(
            id,
            handle,
            display_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .ilike('content', `%${query}%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [conversationId]);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setResults([]);
  }, []);

  return { 
    searchQuery, 
    setSearchQuery, 
    results, 
    isSearching,
    clearSearch
  };
}
