import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgendaResponse, RunDailyJobResult } from '@ffl/shared';
import { api } from '../../api/client';

export function useAgenda() {
  return useQuery({
    queryKey: ['agenda'],
    queryFn: () => api.get<AgendaResponse>('/sends/agenda'),
  });
}

/** Sidebar badge count — every birthday tracked this year (hoje + próximos + enviados). */
export function useAgendaCount(): number | undefined {
  const { data } = useAgenda();
  if (!data) return undefined;
  return data.hoje.length + data.proximos.length + data.enviados.length;
}

export function useRunNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<RunDailyJobResult>('/sends/run'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  });
}

export function useMarkSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api.post<{ ok: true }>(`/sends/${memberId}/mark-sent`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  });
}

export function useResend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api.post<{ ok: true }>(`/sends/${memberId}/resend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  });
}
