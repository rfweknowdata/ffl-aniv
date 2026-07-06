export interface PushDeviceDTO {
  id: string;
  endpointHost: string;
  userAgent: string | null;
  createdAt: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
