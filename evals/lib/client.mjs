// A minimal client for any OpenAI-compatible chat completions endpoint.

export class EndpointError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export function completionsUrl(baseUrl) {
  const u = new URL(baseUrl);
  const path = u.pathname.replace(/\/+$/, '');
  u.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return u.toString();
}

// Extract the assistant text from a chat completions response. Some servers return content
// as a list of parts.
export function replyText(body) {
  const msg = body?.choices?.[0]?.message;
  if (!msg) throw new EndpointError('response has no choices[0].message');
  const c = msg.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('');
  if (c == null) return '';
  throw new EndpointError('message content is neither text nor a list of parts');
}

export async function chat({ baseUrl, apiKey, model, messages, temperature, maxTokens, timeoutMs = 120000, retries = 2, fetchImpl = fetch }) {
  const body = { model, messages };
  if (temperature !== undefined) body.temperature = temperature;
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(completionsUrl(baseUrl), { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
      const text = await res.text();
      if (!res.ok) {
        const err = new EndpointError(`HTTP ${res.status}: ${text.slice(0, 300)}`, res.status);
        // 429 and 5xx are worth another try; other client errors are not.
        if (res.status === 429 || res.status >= 500) { lastErr = err; await sleep(500 * 2 ** attempt); continue; }
        throw err;
      }
      let json;
      try { json = JSON.parse(text); } catch { throw new EndpointError(`response is not JSON: ${text.slice(0, 200)}`); }
      return { text: replyText(json), usage: json.usage ?? null, model: json.model ?? model };
    } catch (e) {
      if (e instanceof EndpointError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e.name === 'AbortError' ? new EndpointError(`timed out after ${timeoutMs} ms`) : e;
      if (attempt < retries) await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
