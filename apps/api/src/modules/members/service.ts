import { prisma } from '../../db.js';
import { channelOf, type MemberDTO, type MemberInput } from '@ffl/shared';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { matchesQuery } from '../../lib/search.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { Member as PrismaMember } from '../../generated/prisma/client.js';

function toDTO(m: PrismaMember): MemberDTO {
  return {
    id: m.id,
    internalId: m.internalId,
    profaneName: m.profaneName,
    mysticName: m.mysticName,
    birthDate: m.birthDate,
    nif: m.nif,
    phoneNumber: m.phoneNumber,
    email: m.email,
    memberNumber: m.memberNumber,
    notes: m.notes,
    channel: channelOf(m),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

function trimOrNull(v?: string | null): string | null {
  const t = (v ?? '').trim();
  return t ? t : null;
}

function deriveMonthDay(iso: string | null): { birthMonth: number | null; birthDay: number | null } {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { birthMonth: null, birthDay: null };
  return { birthMonth: Number(m[2]), birthDay: Number(m[3]) };
}

function normalizeInput(input: MemberInput) {
  const birthDate = trimOrNull(input.birthDate);
  const { birthMonth, birthDay } = deriveMonthDay(birthDate);
  return {
    profaneName: input.profaneName.trim().toUpperCase(),
    mysticName: trimOrNull(input.mysticName),
    birthDate,
    birthMonth,
    birthDay,
    nif: trimOrNull(input.nif),
    phoneNumber: trimOrNull(input.phoneNumber),
    email: trimOrNull(input.email),
    memberNumber: trimOrNull(input.memberNumber),
    notes: trimOrNull(input.notes),
  };
}

async function nextInternalId(): Promise<string> {
  const members = await prisma.member.findMany({ select: { internalId: true } });
  const nums = members
    .map((m) => Number((m.internalId.match(/(\d+)/) ?? [])[1]))
    .filter((n) => Number.isFinite(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `FFL-${String(n).padStart(3, '0')}`;
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function listMembers(query?: string): Promise<MemberDTO[]> {
  const q = query?.trim();
  const all = await prisma.member.findMany({ orderBy: { profaneName: 'asc' } });
  const filtered = q
    ? all.filter((m) => matchesQuery(q, m.profaneName, m.mysticName, m.email, m.nif, m.internalId, m.phoneNumber))
    : all;
  return filtered.map(toDTO);
}

export async function getMemberOrThrow(id: string): Promise<PrismaMember> {
  const m = await prisma.member.findUnique({ where: { id } });
  if (!m) throw new NotFoundError('Sócio não encontrado');
  return m;
}

export async function getMember(id: string): Promise<MemberDTO> {
  return toDTO(await getMemberOrThrow(id));
}

export async function createMember(input: MemberInput): Promise<MemberDTO> {
  const data = normalizeInput(input);
  const internalId = input.internalId?.trim() || (await nextInternalId());
  try {
    const created = await prisma.member.create({ data: { ...data, internalId } });
    return toDTO(created);
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new ConflictError('ID Interno já existe');
    throw err;
  }
}

export async function updateMember(id: string, input: MemberInput): Promise<MemberDTO> {
  await getMemberOrThrow(id);
  const data = normalizeInput(input);
  const internalId = input.internalId?.trim() || undefined;
  try {
    const updated = await prisma.member.update({
      where: { id },
      data: { ...data, ...(internalId ? { internalId } : {}) },
    });
    return toDTO(updated);
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new ConflictError('ID Interno já existe');
    throw err;
  }
}

export async function deleteMember(id: string): Promise<void> {
  await getMemberOrThrow(id);
  await prisma.member.delete({ where: { id } });
}
