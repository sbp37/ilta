const CACHE = 'ilta-v2'

self.addEventListener('install', (e) => {
  // 앱이 배포된 실제 경로(예: /ilta/)를 캐시 — 루트가 아닐 수 있음
  const base = new URL('./', self.location.href).pathname
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([base])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

// 같은 출처 GET만: 네트워크 우선, 실패 시 캐시 (앱 데이터는 localStorage에 있으므로 안전)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request)),
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
