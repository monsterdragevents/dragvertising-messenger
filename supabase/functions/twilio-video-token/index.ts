import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2'
import twilio from 'https://esm.sh/twilio@4.19.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwilioVideoTokenRequest {
  conversationId: string;
  roomName?: string;
  identity?: string;
}

Deno.serve(async (req: Request) => {
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

    const authToken = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken)
    
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

    // Create Twilio access token with video grant using Twilio SDK
    const AccessToken = twilio.jwt.AccessToken
    const VideoGrant = AccessToken.VideoGrant

    // Create a Video grant
    const videoGrant = new VideoGrant({
      room: roomName,
    })

    // Create an access token (valid for 24 hours)
    const accessToken = new AccessToken(
      twilioAccountSid,
      twilioApiKeySid,
      twilioApiKeySecret,
      {
        identity: identity,
        ttl: 86400, // 24 hours
      }
    )

    // Add the Video grant to the token
    accessToken.addGrant(videoGrant)

    // Serialize the token to a JWT string
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