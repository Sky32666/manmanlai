// 慢慢来 · service worker：让 App 能放到主屏幕，并接收推送通知
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "慢慢来", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "慢慢来", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || undefined,
    data: { tab: d.tab || "focus", action: d.action || "" }
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const { tab, action } = e.notification.data || {};
  const url = new URL(`./?tab=${tab || "focus"}${action ? "&do=" + action : ""}`, self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) { w.postMessage({ tab, action }); return w.focus(); }
    return self.clients.openWindow(url);
  })());
});
