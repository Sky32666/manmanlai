// 极简 service worker：让 iPhone 可以“添加到主屏幕”像 App 一样打开
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
