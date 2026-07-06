import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberDTO, MemberInput } from '@ffl/shared';
import { api } from '../../api/client';

export function useMembers(query: string) {
  return useQuery({
    queryKey: ['members', query],
    queryFn: () => api.get<MemberDTO[]>(`/members${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  });
}

/** Sidebar badge count — total active members, regardless of search. */
export function useMembersCount(): number | undefined {
  const { data } = useQuery({
    queryKey: ['members', ''],
    queryFn: () => api.get<MemberDTO[]>('/members'),
  });
  return data?.length;
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MemberInput) => api.post<MemberDTO>('/members', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MemberInput }) =>
      api.put<MemberDTO>(`/members/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}
