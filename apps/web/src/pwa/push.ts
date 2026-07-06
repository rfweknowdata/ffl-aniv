import { api } from '../api/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error('Este navegador não suporta notificações push.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificações negada.');

  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await (async () => {
      const { publicKey } = await api.get<{ publicKey: string }>('/push/vapid');
      return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    })());

  const json = subscription.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
}

export async function disablePush(): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
