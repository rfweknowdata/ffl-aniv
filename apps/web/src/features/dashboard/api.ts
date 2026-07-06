import { useQuery } from '@tanstack/react-query';
import type { DashboardResponse } from '@ffl/shared';
import { api } from '../../api/client';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardResponse>('/dashboard') });
}
