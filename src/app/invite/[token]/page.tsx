'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/logo'
import { UserPlus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { GroupInvite, Group } from '@/lib/types'

type InviteState =
  | { status: 'loading' }
  | { status: 'valid'; invite: GroupInvite; group: Group; isLoggedIn: boolean }
  | { status: 'already_member'; group: Group }
  | { status: 'error'; message: string }
  | { status: 'joining' }
  | { status: 'joined'; groupId: string }

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [state, setState] = useState<InviteState>({ status: 'loading' })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function validateInvite() {
      // Fetch invite by token
      const { data: invite, error: inviteError } = await supabase
        .from('group_invites')
        .select('*')
        .eq('token', token)
        .single()

      if (inviteError || !invite) {
        setState({ status: 'error', message: 'Link de convite invalido ou não encontrado.' })
        return
      }

      // Check expiration
      if (new Date(invite.expires_at) < new Date()) {
        setState({ status: 'error', message: 'Este convite expirou.' })
        return
      }

      // Check max uses
      if (invite.uses >= invite.max_uses) {
        setState({ status: 'error', message: 'Este convite atingiu o limite maximo de usos.' })
        return
      }

      // Fetch group info
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', invite.group_id)
        .single()

      if (groupError || !group) {
        setState({ status: 'error', message: 'Grupo não encontrado.' })
        return
      }

      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setState({ status: 'valid', invite, group, isLoggedIn: false })
        return
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', invite.group_id)
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .single()

      if (existingMember) {
        setState({ status: 'already_member', group })
        return
      }

      setState({ status: 'valid', invite, group, isLoggedIn: true })
    }

    validateInvite()
  }, [token])

  async function handleJoin() {
    if (state.status !== 'valid' || !state.isLoggedIn) return

    setState({ status: 'joining' })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Você precisa estar logado para entrar no grupo.')
      setState({ status: 'error', message: 'Sessao expirada. Faca login novamente.' })
      return
    }

    // Double-check membership
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', state.invite.group_id)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .single()

    if (existingMember) {
      toast.info('Você ja faz parte deste grupo!')
      router.push(`/dashboard/${state.invite.group_id}`)
      return
    }

    // Get user profile name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const memberName = profile?.full_name || user.user_metadata?.full_name || user.email || 'Membro'

    // Insert into group_members
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: state.invite.group_id,
        profile_id: user.id,
        name: memberName,
        role: 'member',
        member_type: 'mensalista',
      })

    if (memberError) {
      toast.error('Erro ao entrar no grupo', { description: memberError.message })
      setState({ status: 'error', message: 'Erro ao entrar no grupo. Tente novamente.' })
      return
    }

    // Increment uses count
    await supabase
      .from('group_invites')
      .update({ uses: state.invite.uses + 1 })
      .eq('id', state.invite.id)

    toast.success('Você entrou no grupo!', {
      description: `Bem-vindo ao ${state.group.name}`,
      icon: <CheckCircle2 className="h-4 w-4" />,
    })

    setState({ status: 'joined', groupId: state.invite.group_id })
    router.push(`/dashboard/${state.invite.group_id}`)
  }

  function handleRedirectToRegister() {
    if (state.status !== 'valid') return
    const redirectUrl = `/invite/${token}`
    router.push(`/register?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-surface mesh-bg px-4">
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link href="/"><Logo size="lg" /></Link>
        </div>
        <div className="card-modern-elevated p-8">
          {/* Loading */}
          {state.status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
              <p className="text-muted-foreground text-sm">Verificando convite...</p>
            </div>
          )}

          {/* Error */}
          {state.status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-brand-navy tracking-tight">Convite invalido</h1>
                <p className="text-muted-foreground text-sm mt-2">{state.message}</p>
              </div>
              <Link
                href="/login"
                className="btn-modern-green inline-flex items-center justify-center gap-2 mt-2 px-6"
              >
                Ir para o login
              </Link>
            </div>
          )}

          {/* Already a member */}
          {state.status === 'already_member' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-brand-navy tracking-tight">Você ja esta no grupo!</h1>
                <p className="text-muted-foreground text-sm mt-2">
                  Você ja faz parte do grupo <strong>{state.group.name}</strong>.
                </p>
              </div>
              <Link
                href={`/dashboard/${state.group.id}`}
                className="btn-modern-green inline-flex items-center justify-center gap-2 mt-2 px-6"
              >
                Ir para o grupo
              </Link>
            </div>
          )}

          {/* Valid invite */}
          {state.status === 'valid' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="h-14 w-14 rounded-full bg-brand-green/10 flex items-center justify-center">
                <UserPlus className="h-7 w-7 text-brand-green" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-brand-navy tracking-tight">
                  Convite para grupo
                </h1>
                <p className="text-muted-foreground text-sm mt-2">
                  Você foi convidado para participar do grupo
                </p>
                <p className="text-lg font-bold text-brand-navy mt-1">{state.group.name}</p>
                {state.group.description && (
                  <p className="text-muted-foreground text-xs mt-1">{state.group.description}</p>
                )}
              </div>

              {state.isLoggedIn ? (
                <button
                  onClick={handleJoin}
                  className="btn-modern-green w-full flex items-center justify-center gap-2 mt-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Entrar no Grupo
                </button>
              ) : (
                <div className="w-full space-y-3 mt-2">
                  <p className="text-sm text-muted-foreground">
                    Faca login ou crie uma conta para entrar no grupo.
                  </p>
                  <button
                    onClick={handleRedirectToRegister}
                    className="btn-modern-green w-full flex items-center justify-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Criar conta e entrar
                  </button>
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                    className="block w-full text-center text-sm text-brand-green hover:underline font-semibold"
                  >
                    Ja tenho conta - Fazer login
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Joining */}
          {state.status === 'joining' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
              <p className="text-muted-foreground text-sm">Entrando no grupo...</p>
            </div>
          )}

          {/* Joined */}
          {state.status === 'joined' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-brand-navy tracking-tight">Você entrou no grupo!</h1>
                <p className="text-muted-foreground text-sm mt-2">Redirecionando para o dashboard...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
