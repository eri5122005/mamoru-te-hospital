// ★ 新しい Service Worker を即時反映
self.addEventListener("install", (event) => {
  self.skipWaiting(); // ← 待機せず即アクティブ化
});

// ★ 古い Service Worker を即時置き換え
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim()); // ← 全クライアントに即反映
});

// ★ 最小構成のキャッシュ戦略（オンライン優先）
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // キャッシュがあれば使う、なければネットから取得
      return response || fetch(event.request);
    })
  );
});
