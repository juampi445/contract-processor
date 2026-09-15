'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Loader2, Send, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmPopover } from '@/components/confirm-popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { dbErrorMessage } from '@/lib/auth/errors';
import { ROLE_LABELS, type MemberRole } from '@/lib/auth/types';
import { initials } from '@/lib/initials';
import { createClient } from '@/lib/supabase/client';
import { inviteMemberAction, resendInvitationAction } from './actions';

export interface Member {
  userId: string;
  role: MemberRole;
  email: string | null;
  fullName: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: MemberRole;
  createdAt: string;
}

const ROLE_ITEMS = [
  { value: 'member', label: ROLE_LABELS.member },
  { value: 'owner', label: ROLE_LABELS.owner },
];

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });

function RoleSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: MemberRole;
  onChange: (role: MemberRole) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Select
      items={ROLE_ITEMS}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === 'owner' || next === 'member') onChange(next);
      }}
    >
      <SelectTrigger aria-label={label} className="h-8 w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end" sideOffset={6}>
        {ROLE_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Fallback when the email can't be delivered: the link still works. */
async function copyInviteLink(email: string) {
  const url = `${window.location.origin}/signup?email=${encodeURIComponent(email)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado', { description: `Compartíselo a ${email}.` });
  } catch {
    toast.error('No se pudo copiar el link', { description: url });
  }
}

function InviteForm({ companyId, onInvited }: { companyId: string; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await inviteMemberAction(companyId, email, role).catch(() => ({
      ok: false as const,
      error: dbErrorMessage(null),
    }));

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEmail('');
    setRole('member');
    if (result.emailSent) {
      toast.success(`Invitación enviada a ${result.email}`, {
        description: 'Le llega un email con el link para unirse.',
      });
    } else {
      const invited = result.email;
      toast.warning('Creamos la invitación, pero no pudimos enviar el email', {
        description: 'Probá reenviarla desde la lista o copiá el link.',
        action: { label: 'Copiar link', onClick: () => void copyInviteLink(invited) },
      });
    }
    onInvited();
  }

  return (
    <form onSubmit={onSubmit}>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="invite-email">Invitar por email</FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            autoComplete="off"
            required
            aria-invalid={error ? true : undefined}
            className="h-9 sm:flex-1"
          />
          <div className="flex gap-2">
            <RoleSelect value={role} onChange={setRole} label="Rol de la invitación" />
            <Button type="submit" disabled={pending || !email.trim()} className="h-9 flex-1 sm:flex-none">
              {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Invitar
            </Button>
          </div>
        </div>
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>
            Le enviamos un email con el link para unirse. Si ya tiene cuenta, entra a la empresa la
            próxima vez que ingrese.
          </FieldDescription>
        )}
      </Field>
    </form>
  );
}

export function MembersSettings({
  companyId,
  currentUserId,
  isOwner,
  members,
  invitations,
}: {
  companyId: string;
  currentUserId: string;
  isOwner: boolean;
  members: Member[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const ownerCount = members.filter((m) => m.role === 'owner').length;

  async function changeRole(member: Member, role: MemberRole) {
    if (role === member.role) return;
    setSavingRoleFor(member.userId);
    const { error } = await supabase
      .from('memberships')
      .update({ role })
      .eq('company_id', companyId)
      .eq('user_id', member.userId)
      .select('user_id')
      .single();
    setSavingRoleFor(null);
    if (error) {
      toast.error(dbErrorMessage(error));
      return;
    }
    toast.success('Rol actualizado.');
    router.refresh();
  }

  async function removeMember(member: Member): Promise<boolean> {
    const leaving = member.userId === currentUserId;
    const { error, count } = await supabase
      .from('memberships')
      .delete({ count: 'exact' })
      .eq('company_id', companyId)
      .eq('user_id', member.userId);
    if (error || count !== 1) {
      toast.error(dbErrorMessage(error));
      return false;
    }
    if (leaving) {
      toast.success('Saliste de la empresa.');
      router.replace('/');
    } else {
      toast.success(`${member.fullName || member.email} ya no tiene acceso.`);
    }
    router.refresh();
    return true;
  }

  async function resendInvitation(invitation: Invitation) {
    setResendingId(invitation.id);
    const result = await resendInvitationAction(invitation.id).catch(() => ({
      ok: false as const,
      error: dbErrorMessage(null),
    }));
    setResendingId(null);
    if (result.ok) {
      toast.success(`Reenviamos la invitación a ${result.email}.`);
    } else {
      toast.error(result.error);
    }
  }

  async function cancelInvitation(invitation: Invitation): Promise<boolean> {
    const { error, count } = await supabase
      .from('invitations')
      .delete({ count: 'exact' })
      .eq('id', invitation.id);
    if (error || count !== 1) {
      toast.error(dbErrorMessage(error));
      return false;
    }
    toast.success('Invitación cancelada.');
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-8">
      {isOwner && <InviteForm companyId={companyId} onInvited={() => router.refresh()} />}

      <ul className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {members.map((member) => {
          const isSelf = member.userId === currentUserId;
          const name = member.fullName || member.email || 'Sin nombre';
          const lastOwner = member.role === 'owner' && ownerCount === 1;

          return (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Avatar>
                <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="truncate">{name}</span>
                  {isSelf && <Badge variant="secondary">Vos</Badge>}
                </p>
                {member.fullName && member.email && (
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {isOwner && !isSelf ? (
                  <>
                    <RoleSelect
                      value={member.role}
                      onChange={(role) => void changeRole(member, role)}
                      disabled={savingRoleFor === member.userId}
                      label={`Rol de ${name}`}
                    />
                    <ConfirmPopover
                      title={`¿Quitar a ${name}?`}
                      description="Pierde el acceso a la empresa de inmediato."
                      confirmLabel="Quitar"
                      onConfirm={() => removeMember(member)}
                      trigger={
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Quitar a ${name}`}
                        >
                          <Trash2 />
                        </Button>
                      }
                    />
                  </>
                ) : (
                  <span className="px-2 text-sm text-muted-foreground">
                    {ROLE_LABELS[member.role]}
                  </span>
                )}

                {isSelf && !lastOwner && (
                  <ConfirmPopover
                    title="¿Salir de la empresa?"
                    description="Para volver a entrar, un dueño tiene que invitarte de nuevo."
                    confirmLabel="Salir"
                    onConfirm={() => removeMember(member)}
                    trigger={
                      <Button type="button" size="sm" variant="ghost">
                        Salir
                      </Button>
                    }
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">Invitaciones pendientes</h3>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay invitaciones pendientes. Las que crees aparecen acá hasta que la persona
              ingrese.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
              {invitations.map((invitation) => {
                const resending = resendingId === invitation.id;
                return (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[invitation.role]}, invitado el{' '}
                        {dateFormat.format(new Date(invitation.createdAt))}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resending}
                        onClick={() => void resendInvitation(invitation)}
                      >
                        {resending ? <Loader2 className="animate-spin" /> : <Send />}
                        Reenviar
                      </Button>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Copiar link de invitación de ${invitation.email}`}
                              onClick={() => void copyInviteLink(invitation.email)}
                            />
                          }
                        >
                          <Link2 />
                        </TooltipTrigger>
                        <TooltipContent>Copiar link</TooltipContent>
                      </Tooltip>
                      <ConfirmPopover
                        title="¿Cancelar la invitación?"
                        description={`${invitation.email} no va a poder entrar con esta invitación.`}
                        confirmLabel="Cancelar invitación"
                        onConfirm={() => cancelInvitation(invitation)}
                        trigger={
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Cancelar invitación de ${invitation.email}`}
                          >
                            <Trash2 />
                          </Button>
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
