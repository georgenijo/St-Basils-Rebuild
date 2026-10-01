// Adds a fixed delay to every request to a local Supabase stack, so page
// benchmarks feel the round trips a deployed app pays to hosted Supabase.
//
// Usage: node scripts/bench/latency-proxy.mjs <listenPort> <targetOrigin> <delayMs>
//   e.g. node scripts/bench/latency-proxy.mjs 54400 http://127.0.0.1:54321 40
// Then point NEXT_PUBLIC_SUPABASE_URL at http://127.0.0.1:<listenPort>.
import http from 'node:http'

const [portArg, targetArg, delayArg] = process.argv.slice(2)
if (!portArg || !targetArg) {
  console.error('usage: latency-proxy.mjs <listenPort> <targetOrigin> [delayMs]')
  process.exit(1)
}
const target = new URL(targetArg)
const delayMs = Number(delayArg ?? 40)

http
  .createServer((req, res) => {
    setTimeout(() => {
      const upstream = http.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: target.host },
        },
        (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
          upstreamRes.pipe(res)
        }
      )
      upstream.on('error', (error) => {
        res.writeHead(502)
        res.end(String(error))
      })
      req.pipe(upstream)
    }, delayMs)
  })
  .listen(Number(portArg), '127.0.0.1', () =>
    console.log(`latency proxy :${portArg} -> ${target.origin} (+${delayMs} ms per request)`)
  )
