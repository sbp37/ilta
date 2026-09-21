const CACHE = 'ilta-__ILTA_BUILD__'
const PRECACHE = [] // BUILD_ASSETS
const BASE = new URL('./', self.location.href)

self.addEventListener('install', (e) => {
  // 앱이 배포된 실제 경로(예: /ilta/)를 캐시 — 루트가 아닐 수 있음
  const paths = PRECACHE.length ? PRECACHE : ['./', 'fonts/neodgm.woff2']
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(paths.map((p) => new URL(p, BASE).href)))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('ilta-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

// 같은 출처 GET만: 네트워크 우선, 실패 시 캐시 (앱 데이터는 localStorage에 있으므로 안전)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (
    e.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE.pathname)
  )
    return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          e.waitUntil(
            caches
              .open(CACHE)
              .then((c) => c.put(e.request, copy))
              .catch(() => {}),
          )
        }
        return res
      })
      .catch(
        async () =>
          (await caches.match(e.request)) ||
          (e.request.mode === 'navigate' ? await caches.match(BASE.href) : undefined) ||
          new Response('Offline', { status: 503 }),
      ),
  )
})

// 알림 탭하면 앱 창으로 돌아오기
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const base = new URL('./', self.location.href).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(base))
      if (open) return open.focus()
      return self.clients.openWindow(base)
    }),
  )
})
