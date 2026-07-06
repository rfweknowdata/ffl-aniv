import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PushDeviceDTO, SettingsDTO, SettingsInput } from '@ffl/shared';
import { api } from '../../api/client';

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api.get<SettingsDTO>('/settings') });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) => api.put<SettingsDTO>('/settings', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useTestEmail() {
  return useMutation({
    mutationFn: (to: string) => api.post<{ ok: true }>('/settings/test-email', { to }),
  });
}

export function useDevices() {
  return useQuery({ queryKey: ['push-devices'], queryFn: () => api.get<PushDeviceDTO[]>('/push/devices') });
}

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/push/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-devices'] }),
  });
}
