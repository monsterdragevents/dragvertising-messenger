import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Simple JWT implementation for Twilio access token
function createAccessToken(identity: string, roomName: string, accountSid: string, apiKeySid: string, apiKeySecret: string): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const ttl = 3600; // 1 hour

  const payload = {
    jti: Math.random().toString(36).substring(2, 15),
    grants: {
      room: roomName
    },
    identity,
    iat: now,
    exp: now + ttl
  };

  // Create signature
  const signingKey = Buffer.from(apiKeySecret);
  const signature = await crypto.subtle.importKey(
    'raw',
    signingKey,
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign']
  );

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signatureArray = await crypto.subtle.sign('HMAC', signature, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureArray)));

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwilioVideoTokenRequest {
  conversationId: string;
  roomName?: string;
  identity?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioApiKeySid = Deno.env.get('TWILIO_API_KEY_SID')
    const twilioApiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET')

    if (!twilioAccountSid || !twilioApiKeySid || !twilioApiKeySecret) {
      throw new Error('Twilio credentials not configured')
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth token and verify user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication token')
    }

    // Parse request body
    const body: TwilioVideoTokenRequest = await req.json()
    const { conversationId, roomName: requestedRoomName, identity: requestedIdentity } = body

    if (!conversationId) {
      throw new Error('conversationId is required')
    }

    // Verify user is a participant in the conversation
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select(`
        id,
        profile_universe_id,
        conversations!inner(
          id,
          universes!inner(
            id,
            is_active
          )
        )
      `)
      .eq('conversations.id', conversationId)
      .eq('profile_universe.user_id', user.id)
      .single()

    if (participationError || !participation) {
      throw new Error('User is not a participant in this conversation')
    }

    // Check if universe is active
    if (!participation.conversations.universes.is_active) {
      throw new Error('Universe is not active')
    }

    // Generate deterministic room name if not provided
    const roomName = requestedRoomName || `conversation_${conversationId}`

    // Sanitize identity - use user ID or provided identity
    const identity = requestedIdentity || user.id

    // Create Twilio access token with video grant
    const accessToken = new AccessToken(
      twilioAccountSid,
      twilioApiKeySid,
      twilioApiKeySecret,
      { identity }
    )

    // Add video grant for the specific room
    const videoGrant = {
      room: roomName
    }

    accessToken.addGrant(videoGrant)

    // Generate token
    const jwt = accessToken.toJwt()

    // Log token issuance for debugging
    console.log('[TwilioVideoToken] Token issued', {
      userId: user.id,
      conversationId,
      roomName,
      identity
    })

    return new Response(
      JSON.stringify({
        token: jwt,
        roomName,
        identity
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[TwilioVideoToken] Error:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message?.includes('authentication') ? 401 : 400,
      }
    )
  }
})