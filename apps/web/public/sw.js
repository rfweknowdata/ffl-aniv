// Deliberately minimal — this is an online-only admin tool (no email/DB access without a
// connection anyway), so there's no real offline use case worth the complexity of a
// Workbox precache/app-shell setup. This SW exists to (a) make the app installable as a PWA
// and (b) handle Web Push. See PLAN.md §8 for the reasoning.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Fiat Lux', body: '' };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // malformed payload — fall back to the default above
  }
  event.waitUntil(self.registration.showNotification(payload.title || 'Fiat Lux', { body: payload.body || '' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    }),
  );
});
