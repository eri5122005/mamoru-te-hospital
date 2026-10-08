// MAMORU-TE Service Worker
// 常に最新の画面・APIをネットワークから取得する

self.addEventListener("install", () => {
  // 新しいService Workerを待機させず有効化する
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 以前のService Workerが作成したキャッシュを削除する
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    })
  );

  // 開いている画面を新しいService Workerの管理下にする
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // GET以外はそのままネットワークへ
  if (event.request.method !== "GET") {
    return;
  }

  // キャッシュを使用せず、常にネットワークから取得する
  event.respondWith(fetch(event.request));
});