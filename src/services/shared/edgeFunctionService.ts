/**
 * Edge Function Service - Simplified for Messenger
 */

import { supabase } from '@/integrations/supabase/client';

export interface EdgeFunctionResponse<T = unknown> {
  data: T | null;
  error: string | null;
  success: boolean;
}

class EdgeFunctionClient {
  async callFunction<T = unknown>(
    functionName: string,
    body: unknown = {}
  ): Promise<EdgeFunctionResponse<T>> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return {
          data: null,
          error: 'No active session found',
          success: false,
        };
      }

      const result = await supabase.functions.invoke(functionName, {
        body: body as any,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (result.error) {
        return {
          data: null,
          error: result.error.message || 'Edge function error',
          success: false,
        };
      }

      return {
        data: result.data as T,
        error: null,
        success: true,
      };
    } catch (error: any) {
      return {
        data: null,
        error: error.message || 'Unknown error',
        success: false,
      };
    }
  }
}

export const edgeFunctionService = new EdgeFunctionClient();

