import Link from 'next/link'
import Image from 'next/image'
import { CreditCard, Users, Receipt, Trophy, Share2, Zap, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/shared/logo'

const features = [
  {
    icon: CreditCard,
    title: 'Controle de Mensalidades',
    description: 'Gere mensalidades com um clique e acompanhe quem pagou em tempo real.',
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    icon: Users,
    title: 'Jogadores Avulsos',
    description: 'Registre e controle pagamentos de jogadores que participam eventualmente.',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    icon: Receipt,
    title: 'Gestão de Despesas',
    description: 'Controle gastos com quadra, goleiro, equipamentos e muito mais.',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    icon: Trophy,
    title: 'Ranking de Pagadores',
    description: 'Gamificação: quem paga em dia sobe no ranking e ganha destaque.',
    gradient: 'from-yellow-500 to-amber-600',
  },
  {
    icon: Share2,
    title: 'Prestação de Contas',
    description: 'Link público para compartilhar no WhatsApp com total transparência.',
    gradient: 'from-green-500 to-teal-600',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Financeiro',
    description: 'Visão completa de entradas, saídas e saldo do seu grupo.',
    gradient: 'from-purple-500 to-violet-600',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="text-sm font-medium text-brand-navy hover:text-brand-green transition-colors px-3 py-2">
              Entrar
            </Link>
            <Link href="/register" className="btn-modern-green !py-2 !px-4 text-sm !rounded-lg">
              Criar Conta
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="gradient-brand-hero animated-gradient text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-green/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-20 md:pt-40 md:pb-32 text-center relative z-10">
          <div className="flex justify-center mb-8">
            <div className="hidden md:block"><Logo size="hero" variant="white" /></div>
            <div className="md:hidden"><Logo size="xl" variant="white" /></div>
          </div>
          <p className="text-lg md:text-2xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            A forma mais simples de gerenciar a tesouraria do seu grupo de futebol.
            Controle mensalidades, despesas e preste contas com transparência.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="btn-modern-green text-lg !px-8 !py-4 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Começar Grátis
            </Link>
            <Link href="#features" className="btn-modern-outline flex items-center gap-2 !py-4">
              Conheça as funcionalidades
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-sm text-white/40 mt-6 tracking-wide">Grátis para sempre. Sem cartão de crédito.</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 gradient-surface relative mesh-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-brand-green/10 text-brand-green mb-4">
              Funcionalidades
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy mb-4 tracking-tight">
              Tudo que você precisa para organizar a pelada
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Chega de planilha no Excel e anotação no caderno. Gerencie tudo em um só lugar.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="card-modern-elevated p-6 group">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-brand-navy text-lg mb-2 tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-brand-navy/10 text-brand-navy mb-4">
              Simples e Rápido
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
              Como funciona
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: '1', title: 'Crie seu grupo', desc: 'Cadastre seu grupo de pelada e adicione os membros em segundos.' },
              { step: '2', title: 'Gerencie tudo', desc: 'Controle mensalidades, avulsos, despesas e acompanhe em tempo real.' },
              { step: '3', title: 'Compartilhe', desc: 'Envie o link de prestação de contas no WhatsApp com um toque.' },
            ].map((item, i) => (
              <div key={item.step} className="text-center group">
                <div className="relative mx-auto mb-6">
                  <div className="h-16 w-16 rounded-2xl gradient-green text-white flex items-center justify-center text-2xl font-extrabold mx-auto shadow-lg glow-green group-hover:glow-green-strong transition-all duration-300">
                    {item.step}
                  </div>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-[calc(50%-2rem)] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-brand-green/30 to-transparent" />
                  )}
                </div>
                <h3 className="font-bold text-brand-navy text-xl mb-3 tracking-tight">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / benefits */}
      <section className="py-20 gradient-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="card-modern-elevated p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold text-brand-navy mb-8 tracking-tight">
              Por que usar o PeladeiroPro?
            </h2>
            <div className="grid gap-4 md:grid-cols-2 text-left max-w-2xl mx-auto">
              {[
                'Geração automática de mensalidades',
                'Ranking gamificado de pagadores',
                'Prestação de contas transparente',
                'Compartilhamento via WhatsApp',
                'Controle de jogadores avulsos',
                'Dashboard financeiro completo',
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 py-2">
                  <CheckCircle2 className="h-5 w-5 text-brand-green flex-shrink-0" />
                  <span className="font-medium text-brand-navy">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 gradient-brand-hero animated-gradient text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-green/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-tight">
            Pronto para organizar sua pelada?
          </h2>
          <p className="text-white/60 mb-10 text-lg">
            Crie sua conta em segundos e comece a gerenciar a tesouraria do seu grupo agora mesmo.
          </p>
          <Link href="/register" className="btn-modern-green text-lg !px-10 !py-4 inline-flex items-center gap-2">
            Criar Conta Grátis
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex justify-center mb-3">
            <Logo size="sm" />
          </div>
          <p className="text-sm text-muted-foreground">
            Gestão de tesouraria para grupos de futebol
          </p>
        </div>
      </footer>
    </div>
  )
}
