'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/logo'
import { ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (error) {
      toast.error('Erro ao criar conta', { description: error.message })
      setLoading(false)
      return
    }

    toast.success('Conta criada com sucesso!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-surface mesh-bg px-4">
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link href="/"><Logo size="lg" /></Link>
        </div>
        <div className="card-modern-elevated p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight">Criar sua conta</h1>
            <p className="text-muted-foreground text-sm mt-1">Comece a gerenciar sua pelada agora</p>
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">Nome completo</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11 rounded-xl border-gray-200 focus:border-brand-green focus:ring-brand-green/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl border-gray-200 focus:border-brand-green focus:ring-brand-green/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 rounded-xl border-gray-200 focus:border-brand-green focus:ring-brand-green/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-modern-green w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando conta...' : (
                <>Criar conta grátis <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="text-brand-green hover:underline font-semibold">
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
