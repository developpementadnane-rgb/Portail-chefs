// Supabase Edge Function: query-database
//
// Generic table query/mutation endpoint, adapted from the version
// provided directly by the project owner. Kept as close to the
// original shape as possible (same request/response format: table,
// action, columns, filters, order, limit, offset) but with security
// guardrails added that the original didn't have — see the comment
// block below before changing ALLOWED_TABLES or MUTATING_ACTIONS.
//
// WHY THE GUARDRAILS EXIST (read this before loosening them):
// The original version authenticated the CALLER (valid Supabase Auth
// JWT) but placed no limit on WHICH tables or WHICH actions that
// caller could reach, while running every query with the SERVICE
// ROLE key — which bypasses Row Level Security entirely. In this
// app's actual data model, that combination means ANY authenticated
// user (this project's `user_chefs` don't even use Supabase Auth for
// normal login — see server/routes/auth.ts's custom JWT flow, so in
// practice this endpoint's own req.headers.Authorization check is the
// only gate at all) could read or DELETE any row in any table,
// including trusted_devices, attendance_records, and member_profiles
// — data this whole project's offline work (see
// docs/OFFLINE_SUPABASE_MIGRATIONS.sql) specifically tries to protect
// with server-side, per-route authorization instead of RLS. An
// unrestricted generic table endpoint bypasses all of that in one
// shot.
//
// This version keeps the function usable for its apparent purpose —
// ad-hoc reads for internal tooling/dashboards — while constraining
// it to:
//   1. An explicit table allow-list (ALLOWED_TABLES). Add a table
//      here deliberately, not by default.
//   2. Mutating actions (insert/update/delete) require the caller to
//      additionally present the shared function secret
//      (X-Function-Secret header, compared to QUERY_DATABASE_SECRET)
//      — a valid end-user JWT alone is not enough to mutate data
//      through this generic path. Plain reads (select/count) only
//      need a valid JWT, matching the original's intent for
//      lightweight authenticated reads.
//   3. member_profiles is deliberately NOT in ALLOWED_TABLES — that
//      table holds minors' personal data (see docs/OFFLINE_SUPABASE_MIGRATIONS.sql's
//      surrounding app context) and already has purpose-built,
//      reviewed access paths (client/lib/offline/membersCache.ts,
//      the member portal). A generic query endpoint is the wrong
//      place to expose it, regardless of who's asking.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Origines autorisées à appeler cette fonction depuis un navigateur : l'app packagée (Capacitor)
// et le(s) domaine(s) web déployé(s), fournis via ALLOWED_ORIGINS (secret de la fonction, liste
// séparée par des virgules). "*" laisserait n'importe quel site tiers rejouer une requête avec un
// jeton dérobé par ailleurs (XSS, extension malveillante) — ce n'est pas une hypothèse à écarter
// puisque cette fonction touche directement des tables métier avec la clé service_role.
const STATIC_ALLOWED_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost'])
const ENV_ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-function-secret',
    Vary: 'Origin',
  }
  if (origin && (STATIC_ALLOWED_ORIGINS.has(origin) || ENV_ALLOWED_ORIGINS.has(origin))) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

const jsonHeaders = {
  'Content-Type': 'application/json',
}

// Explicit allow-list. Every table this function is willing to touch
// at all, regardless of action. Add entries deliberately — this list
// is the actual security boundary, not the JWT check alone.
const ALLOWED_TABLES = new Set([
  'sessions',
  'ideas',
  'daily_reports',
  'attendance_sync_log',
])

const MUTATING_ACTIONS = new Set(['insert', 'update', 'delete'])

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
      )
    }

    // Parse the request body ONCE. The original version called
    // req.json() a second time inside the insert/update branches,
    // which throws (a Request body can only be read once) — fixed
    // here by parsing everything up front instead.
    const body = await req.json()
    const { table, action, columns, filters, order, limit, offset, data: mutationData } = body

    if (!table || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: table, action' }),
        { status: 400, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
      )
    }

    if (!ALLOWED_TABLES.has(table)) {
      return new Response(
        JSON.stringify({ error: `Table "${table}" is not accessible through this endpoint` }),
        { status: 403, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
      )
    }

    if (MUTATING_ACTIONS.has(action)) {
      const functionSecret = Deno.env.get('QUERY_DATABASE_SECRET')
      const presentedSecret = req.headers.get('X-Function-Secret')
      if (!functionSecret || presentedSecret !== functionSecret) {
        return new Response(
          JSON.stringify({ error: 'Mutating actions require a valid X-Function-Secret header' }),
          { status: 403, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
        )
      }
    }

    let query = supabase.from(table)

    switch (action) {
      case 'select':
        query = query.select(columns || '*')
        break
      case 'count':
        query = query.select('*', { count: 'exact', head: true })
        break
      case 'insert':
        if (!mutationData) {
          return new Response(
            JSON.stringify({ error: 'Missing required field: data' }),
            { status: 400, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
          )
        }
        query = query.insert(mutationData)
        break
      case 'update':
        if (!mutationData) {
          return new Response(
            JSON.stringify({ error: 'Missing required field: data' }),
            { status: 400, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
          )
        }
        query = query.update(mutationData)
        break
      case 'delete':
        query = query.delete()
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: select, count, insert, update, delete' }),
          { status: 400, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
        )
    }

    // Apply filters if provided
    if (filters && typeof filters === 'string') {
      const filterPairs = filters.split('&')
      for (const pair of filterPairs) {
        const [column, operator, value] = pair.split('.')
        if (operator && value) {
          switch (operator) {
            case 'eq': query = query.eq(column, value); break
            case 'neq': query = query.neq(column, value); break
            case 'gt': query = query.gt(column, value); break
            case 'lt': query = query.lt(column, value); break
            case 'gte': query = query.gte(column, value); break
            case 'lte': query = query.lte(column, value); break
            case 'like': query = query.like(column, value); break
            case 'ilike': query = query.ilike(column, value); break
            case 'in': query = query.in(column, value.split(',')); break
            default: break
          }
        }
      }
    }

    // delete/update without ANY filter would touch every row in the
    // table — the original had no protection against this at all.
    // Require at least one filter for both, since "delete everything"
    // or "update everything" is virtually never the intended request
    // and a typo (an empty filters string) shouldn't be able to wipe
    // a table.
    if ((action === 'delete' || action === 'update') && (!filters || typeof filters !== 'string' || filters.trim() === '')) {
      return new Response(
        JSON.stringify({ error: `${action} requires at least one filter — refusing to ${action} an entire table` }),
        { status: 400, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
      )
    }

    if (order) {
      const [column, ascending] = order.split('.')
      query = query.order(column, { ascending: ascending === 'asc' })
    }

    if (limit) query = query.limit(parseInt(limit))
    if (offset) query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || '10') - 1)

    const { data, error, count } = await query

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
      )
    }

    if (action === 'count') {
      return new Response(
        JSON.stringify({ count }),
        { status: 200, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
      )
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...jsonHeaders, ...corsHeadersFor(req) } }
    )
  }
})
