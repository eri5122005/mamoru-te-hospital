self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // ★ 今日の使用量APIはキャッシュしない
  if (url.includes("/api/today") || url.includes("/api/today-total")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // ★ それ以外はキャッシュ優先
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
