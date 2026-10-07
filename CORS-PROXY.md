# Nova OS self-hosted CORS proxy

Nova OS includes a built-in CORS proxy at:

`/proxy?url=TARGET_URL`

Example:

`https://YOUR-NOVA-DOMAIN/proxy?url=https%3A%2F%2Fexample.com%2Fapi%2Fdata`

The proxy supports GET, HEAD, and browser OPTIONS preflight requests. It validates DNS results to prevent access to localhost/private/reserved networks, limits redirects, applies a timeout, and adds CORS response headers.

Optional environment variables:

- `NOVA_CORS_PROXY_URL` — external proxy URL to use instead of the built-in `/proxy`.
- `NOVA_CORS_PROXY_TIMEOUT_MS` — target timeout, default 15000 ms, max 60000.
- `NOVA_CORS_PROXY_MAX_REDIRECTS` — redirect limit, default 3, max 5.

The browser helper is available as `window.NovaCorsProxy.url()` and `window.NovaCorsProxy.fetch()`.


## Persistent Nova Watch catalog
Movie and show catalogs are stored server-side in `movies.json` and `shows.json`, with the existing `.js` files kept as browser-compatible mirrors. Set `NOVA_PERSISTENT_DATA_DIR` to a mounted persistent directory (for example `/data` on a Railway Volume) so developer-added movies and shows survive server restarts and redeploys.
