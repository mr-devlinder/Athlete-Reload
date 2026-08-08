const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ClearHistoryRequest = {
  method?: 'password' | 'totp'
  password?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = request.headers.get('Authorization')

  if (!projectUrl || !anonKey || !authorization) {
    return respond({ error: 'Unable to verify this request' }, 401)
  }

  const userResponse = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  })
  const user = await userResponse.json()

  if (!userResponse.ok || !user?.id || !user?.email) {
    return respond({ error: 'Unable to verify this request' }, 401)
  }

  const body = await request.json() as ClearHistoryRequest
  if (body.method === 'totp') {
    if (getTokenAal(authorization) !== 'aal2') {
      return respond({ error: 'Two-factor verification is required' }, 403)
    }
  } else if (body.method === 'password') {
    if (!body.password) return respond({ error: 'Password confirmation is required' }, 403)

    const passwordResponse = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user.email, password: body.password }),
    })
    const passwordSession = await passwordResponse.json()

    if (!passwordResponse.ok || passwordSession?.user?.id !== user.id) {
      return respond({ error: 'Unable to verify this request' }, 403)
    }
  } else {
    return respond({ error: 'A recent password or two-factor confirmation is required' }, 403)
  }

  const cleared = await fetch(`${projectUrl}/rest/v1/rpc/clear_complete_health_data`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: authorization, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!cleared.ok) return respond({ error: 'Unable to clear health data' }, 500)

  return respond({ cleared: true })
})

function getTokenAal(authorization: string) {
  try {
    const payload = authorization.replace(/^Bearer\s+/i, '').split('.')[1]
    if (!payload) return ''
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(normalized)).aal ?? ''
  } catch {
    return ''
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}
