import { createClient } from 'npm:@supabase/supabase-js@2.110.9'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type DeleteRequest = {
  confirmation?: string
  method?: 'password' | 'totp'
  password?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed', stage: 'request' }, 405)

  try {
    const projectUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')

    if (!projectUrl || !anonKey || !serviceRoleKey || !authorization) {
      return respond({ error: 'Your session is missing or expired.', stage: 'authentication' }, 401)
    }

    const userClient = createClient(projectUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await userClient.auth.getUser(token)
    if (userError || !user?.id) {
      return respond({ error: 'Your session is missing or expired.', stage: 'authentication' }, 401)
    }

    const body = await request.json() as DeleteRequest
    if (body.confirmation !== 'DELETE') {
      return respond({ error: 'Type DELETE to confirm permanent deletion.', stage: 'confirmation' }, 400)
    }

    if (body.method === 'totp') {
      if (getTokenAal(token) !== 'aal2') {
        return respond({ error: 'Two-factor verification is required.', stage: 'authentication' }, 403)
      }
    } else if (body.method === 'password') {
      if (!body.password || !user.email) {
        return respond({ error: 'Password confirmation is required.', stage: 'authentication' }, 403)
      }
      const { data: passwordSession, error: passwordError } = await userClient.auth.signInWithPassword({
        email: user.email,
        password: body.password,
      })
      if (passwordError || passwordSession.user?.id !== user.id) {
        return respond({ error: 'The current password was not accepted.', stage: 'authentication' }, 403)
      }
    } else {
      return respond({ error: 'A recent password or two-factor confirmation is required.', stage: 'authentication' }, 403)
    }

    const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false } })
    const storageError = await deleteOwnedStorageObjects(admin, user.id)
    if (storageError) return respond({ error: storageError, stage: 'storage' }, 500)

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      return respond({ error: 'Database or authentication cleanup failed. The account was not reported as deleted.', stage: 'authentication-deletion' }, 500)
    }

    const { data: lookup, error: lookupError } = await admin.auth.admin.getUserById(user.id)
    const lookupConfirmsMissing = !lookup.user && (
      !lookupError || lookupError.code === 'user_not_found' || lookupError.status === 404
    )
    if (!lookupConfirmsMissing) {
      return respond({ error: 'Authentication deletion could not be verified.', stage: 'authentication-deletion' }, 500)
    }

    return respond({ deleted: true })
  } catch (error) {
    console.error('delete-account failed', error)
    return respond({ error: 'Unexpected account deletion failure.', stage: 'unexpected' }, 500)
  }
})

async function deleteOwnedStorageObjects(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: buckets, error: bucketError } = await admin.storage.listBuckets()
  if (bucketError) return 'Storage cleanup could not list buckets.'

  for (const bucket of buckets ?? []) {
    const ownedPaths = await listOwnedPaths(admin, bucket.id, userId)
    if (ownedPaths.error) return `Storage cleanup failed for bucket ${bucket.id}.`

    for (let index = 0; index < ownedPaths.paths.length; index += 100) {
      const { error } = await admin.storage.from(bucket.id).remove(ownedPaths.paths.slice(index, index + 100))
      if (error) return `Storage cleanup failed for bucket ${bucket.id}.`
    }

    const remaining = await listOwnedPaths(admin, bucket.id, userId)
    if (remaining.error || remaining.paths.length > 0) return `Storage cleanup could not be verified for bucket ${bucket.id}.`
  }

  return ''
}

async function listOwnedPaths(admin: ReturnType<typeof createClient>, bucketId: string, userId: string) {
  const paths: string[] = []
  const pending = ['']

  while (pending.length > 0) {
    const prefix = pending.pop() ?? ''
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await admin.storage.from(bucketId).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error) return { error, paths }
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.id) {
          if (item.owner_id === userId) paths.push(path)
        } else {
          pending.push(path)
        }
      }
      if ((data?.length ?? 0) < 100) break
    }
  }

  return { error: null, paths }
}

function getTokenAal(token: string) {
  try {
    const payload = token.split('.')[1]
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
