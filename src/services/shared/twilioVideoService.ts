/**
 * Twilio Video Service
 * Handles fetching access tokens for Twilio Video
 */

import { edgeFunctionService } from './edgeFunctionService';

export interface TwilioVideoTokenResponse {
  token: string;
  roomName: string;
  identity: string;
}

export interface TwilioVideoTokenRequest {
  conversationId: string;
  roomName?: string;
  identity?: string;
}

export async function getTwilioVideoToken(
  conversationId: string,
  roomName?: string,
  identity?: string
): Promise<TwilioVideoTokenResponse> {
  console.log('[TwilioVideoService] Requesting access token', {
    conversationId,
    roomName,
    identity
  });

  const response = await edgeFunctionService.callFunction<TwilioVideoTokenResponse>(
    'twilio-video-token',
    {
      conversationId,
      roomName,
      identity,
    }
  );

  if (!response.success || !response.data) {
    console.error('[TwilioVideoService] Failed to get token', response.error);
    throw new Error(response.error || 'Failed to get Twilio Video token');
  }

  console.log('[TwilioVideoService] Token received successfully');
  return response.data;
}
