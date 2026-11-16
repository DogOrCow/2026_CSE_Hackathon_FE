const defaultTarget = 'https://api-production-f55f4175.up.railway.app'
const requestHeaders = ['authorization', 'accept', 'content-type', 'last-event-id']
const responseHeaders = ['content-type', 'retry-after', 'www-authenticate', 'allow']

function upstreamOrigin(configuredTarget) {
  if (typeof configuredTarget === 'string' && configuredTarget.trim()) {
    try {
      const target = new URL(configuredTarget.trim())
      if (target.protocol === 'https:' && !target.username && !target.password) return target.origin
    } catch {
      // Use the default when the Pages setting is not a valid HTTPS URL.
    }
  }
  return defaultTarget
}

function selectedHeaders(headers, allowed) {
  const result = new Headers()
  for (const name of allowed) {
    const value = headers.get(name)
    if (value !== null) result.set(name, value)
  }
  return result
}

function preventCaching(headers) {
  headers.set('Cache-Control', 'private, no-store, no-transform')
  headers.set('CDN-Cache-Control', 'no-store')
}

function errorResponse(status, code, message) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' })
  preventCaching(headers)
  return new Response(JSON.stringify({ code, message }), { status, headers })
}

export async function onRequest({ request, env }) {
  const incoming = new URL(request.url)
  if (incoming.pathname !== '/api' && !incoming.pathname.startsWith('/api/')) {
    return errorResponse(404, 'NOT_FOUND', '요청한 API 경로가 없어요.')
  }

  const upstreamUrl = new URL(upstreamOrigin(env?.API_PROXY_TARGET))
  upstreamUrl.pathname = incoming.pathname
  upstreamUrl.search = incoming.search

  const options = {
    method: request.method,
    headers: selectedHeaders(request.headers, requestHeaders),
    cache: 'no-store',
    redirect: 'manual',
    signal: request.signal,
  }
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    options.body = request.body
    options.duplex = 'half'
  }

  try {
    const upstream = await fetch(upstreamUrl, options)
    const headers = selectedHeaders(upstream.headers, responseHeaders)
    // Location and Set-Cookie stay on the upstream so the client cannot follow redirects through this proxy.
    preventCaching(headers)
    if (headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')) {
      headers.set('X-Accel-Buffering', 'no')
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
  } catch {
    return errorResponse(502, 'UPSTREAM_UNAVAILABLE', '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')
  }
}
