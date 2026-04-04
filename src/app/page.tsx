import Link from 'next/link'
import { CreditCard, Users, Receipt, Trophy, Share2, Zap, BarChart3, ArrowRight, CheckCircle2, ChevronDown, Shield, Smartphone, Globe } from 'lucide-react'
import { Logo } from '@/components/shared/logo'
import { AnimateOnScroll } from '@/components/shared/animate-on-scroll'
import { AnimatedCounter } from '@/components/shared/animated-counter'

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
    title: 'Gestao de Despesas',
    description: 'Controle gastos com quadra, goleiro, equipamentos e muito mais.',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    icon: Trophy,
    title: 'Ranking de Pagadores',
    description: 'Gamificacao: quem paga em dia sobe no ranking e ganha destaque.',
    gradient: 'from-yellow-500 to-amber-600',
  },
  {
    icon: Share2,
    title: 'Prestacao de Contas',
    description: 'Link publico para compartilhar no WhatsApp com total transparencia.',
    gradient: 'from-green-500 to-teal-600',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Financeiro',
    description: 'Visao completa de entradas, saidas e saldo do seu grupo.',
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    icon: Smartphone,
    title: 'Instale como App',
    description: 'PWA: instale no celular e acesse rapidamente sem abrir navegador.',
    gradient: 'from-pink-500 to-rose-600',
  },
  {
    icon: Shield,
    title: 'Controle de Permissoes',
    description: 'Presidente, tesoureiro e membro: cada um ve e edita apenas o que pode.',
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    icon: Globe,
    title: 'Relatorio PDF',
    description: 'Exporte a prestacao de contas em PDF profissional para enviar ao grupo.',
    gradient: 'from-indigo-500 to-purple-600',
  },
]

const stats = [
  { value: 500, suffix: '+', label: 'Grupos ativos' },
  { value: 10000, suffix: '+', label: 'Jogadores' },
  { value: 2, prefix: 'R$ ', suffix: 'M+', label: 'Gerenciados' },
  { value: 98, suffix: '%', label: 'Satisfacao' },
]

const testimonials = [
  {
    name: 'Rafael Oliveira',
    group: 'Pelada dos Crias FC',
    text: 'Antes eu era o chato que ficava cobrando. Agora o app cobra por mim e eu volto a ser amigo de todo mundo.',
    stars: 5,
  },
  {
    name: 'Carlos Eduardo',
    group: 'Veteranos United',
    text: 'Meu Excel tinha mais abas que jogador no grupo. Com o PeladeiroPro, so preciso de um clique. Minha terapeuta agradeceu.',
    stars: 5,
  },
  {
    name: 'Anderson Lima',
    group: 'Bola Preta FC',
    text: 'O tesoureiro anterior pediu pra sair do grupo. Eu assumi com o PeladeiroPro e agora todo mundo paga em dia. Ate o goleiro.',
    stars: 5,
  },
]

const faqs = [
  {
    q: 'E realmente gratis?',
    a: 'Sim! O PeladeiroPro e 100% gratuito. Acreditamos que todo grupo de pelada merece uma gestao financeira organizada.',
  },
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Nao! Funciona direto no navegador. Mas voce pode instalar como app no celular para acesso rapido (PWA).',
  },
  {
    q: 'Meus dados estao seguros?',
    a: 'Sim. Usamos Supabase (infraestrutura da AWS) com criptografia e Row Level Security. Cada grupo so ve seus proprios dados.',
  },
  {
    q: 'Quantos membros posso ter no grupo?',
    a: 'Sem limite! Adicione todos os mensalistas e avulsos que precisar.',
  },
  {
    q: 'Posso ter mais de um tesoureiro?',
    a: 'Sim! Voce pode promover membros para Tesoureiro ou Presidente nas configuracoes do grupo.',
  },
  {
    q: 'Como funciona a prestacao de contas?',
    a: 'Geramos um link publico que voce compartilha no WhatsApp. Qualquer pessoa acessa e ve receitas, despesas e saldo — sem precisar de conta.',
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
        {/* Decorative floating elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-green/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-green/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full" />
        <div className="absolute top-40 right-20 text-6xl opacity-[0.04] animate-float" style={{ animationDelay: '1s' }}>&#9917;</div>
        <div className="absolute bottom-32 left-16 text-4xl opacity-[0.04] animate-float" style={{ animationDelay: '3s' }}>&#9917;</div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-20 md:pt-40 md:pb-32 text-center relative z-10">
          <div className="flex justify-center mb-8 animate-fade-in-down">
            <div className="hidden md:block"><Logo size="hero" variant="white" /></div>
            <div className="md:hidden"><Logo size="xl" variant="white" /></div>
          </div>
          <p className="text-lg md:text-2xl text-white/70 max-w-2xl mx-auto mb-4 leading-relaxed font-light animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            Agora o seu grupo tambem pode ser uma SAF
          </p>
          <p className="text-sm md:text-base text-white/50 max-w-xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            Chega de anotar no caderninho, cobrar no WhatsApp e ouvir &ldquo;vou pagar semana que vem&rdquo;. O PeladeiroPro resolve.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <Link href="/register" className="btn-modern-green text-lg !px-8 !py-4 flex items-center gap-2 animate-pulse-subtle">
              <Zap className="h-5 w-5" />
              Comecar Gratis
            </Link>
            <Link href="#features" className="btn-modern-outline flex items-center gap-2 !py-4">
              Conheca as funcionalidades
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-sm text-white/40 mt-6 tracking-wide animate-fade-in-up" style={{ animationDelay: '600ms' }}>Gratis para sempre. Sem cartao de credito.</p>

          {/* Scroll indicator */}
          <div className="mt-12 animate-bounce">
            <ChevronDown className="h-6 w-6 text-white/30 mx-auto" />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white relative -mt-8 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="card-modern-elevated p-8 rounded-2xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, i) => (
                <AnimateOnScroll key={stat.label} delay={i * 100} className="text-center">
                  <div className="text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
                    <AnimatedCounter target={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">{stat.label}</p>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 gradient-surface relative mesh-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <AnimateOnScroll className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-brand-green/10 text-brand-green mb-4">
              Funcionalidades
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy mb-4 tracking-tight">
              Tudo que voce precisa para organizar a pelada
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Chega de planilha, caderninho e &ldquo;depois eu pago&rdquo;. Seu grupo merece gestao profissional.
            </p>
          </AnimateOnScroll>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <AnimateOnScroll key={feature.title} delay={i * 80}>
                <div className="card-modern-elevated p-6 group hover-lift gradient-border-hover h-full">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-brand-navy text-lg mb-2 tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-brand-navy/10 text-brand-navy mb-4">
              Simples e Rapido
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
              Como funciona
            </h2>
          </AnimateOnScroll>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: '1', title: 'Crie seu grupo', desc: 'Cadastre o grupo, adicione os membros e pronto. Mais rapido que escalar o time no WhatsApp.' },
              { step: '2', title: 'Gerencie tudo', desc: 'Mensalidades, avulsos, despesas... tudo num so lugar. Seu Excel pode finalmente descansar em paz.' },
              { step: '3', title: 'Compartilhe', desc: 'Mande o link no grupo e deixe a transparencia fazer o trabalho sujo. Ninguem reclama de dados.' },
            ].map((item, i) => (
              <AnimateOnScroll key={item.step} delay={i * 150} className="text-center group">
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
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 gradient-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-brand-green/10 text-brand-green mb-4">
              Depoimentos
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
              O que dizem os tesoureiros
            </h2>
          </AnimateOnScroll>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <AnimateOnScroll key={t.name} delay={i * 120}>
                <div className="card-modern-elevated p-6 h-full flex flex-col hover-lift">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.stars }).map((_, s) => (
                      <span key={s} className="text-amber-400 text-lg">&#9733;</span>
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed flex-1 italic">&ldquo;{t.text}&rdquo;</p>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="font-bold text-brand-navy text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.group}</p>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll>
            <div className="card-modern-elevated p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-extrabold text-brand-navy mb-8 tracking-tight">
                Por que usar o PeladeiroPro?
              </h2>
              <div className="grid gap-4 md:grid-cols-2 text-left max-w-2xl mx-auto">
                {[
                  'Geracao automatica de mensalidades',
                  'Ranking gamificado de pagadores',
                  'Prestacao de contas transparente',
                  'Compartilhamento via WhatsApp',
                  'Lista de presenca por jogo',
                  'Rateio automatico de custos',
                  'Comprovante de pagamento (foto)',
                  'Exportacao de relatorio em PDF',
                  'Dashboard financeiro completo',
                  'Instale como app no celular',
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-3 py-2">
                    <CheckCircle2 className="h-5 w-5 text-brand-green flex-shrink-0" />
                    <span className="font-medium text-brand-navy">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 gradient-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-brand-navy/10 text-brand-navy mb-4">
              Precos
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
              Simples e transparente
            </h2>
          </AnimateOnScroll>
          <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
            {/* Free Plan */}
            <AnimateOnScroll delay={0}>
              <div className="card-modern-elevated p-8 relative overflow-hidden border-2 border-brand-green h-full">
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold bg-brand-green text-white">
                  ATUAL
                </div>
                <h3 className="text-xl font-bold text-brand-navy mb-2">Gratis</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-brand-navy">R$ 0</span>
                  <span className="text-muted-foreground">/para sempre</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Grupos ilimitados', 'Membros ilimitados', 'Mensalidades e despesas', 'Prestacao de contas publica', 'Ranking de pagadores', 'Compartilhamento WhatsApp', 'Lista de presenca', 'Exportacao PDF', 'PWA (instalar como app)'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-brand-green flex-shrink-0" />
                      <span className="text-brand-navy">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="btn-modern-green w-full text-center">
                  Comecar Agora
                </Link>
              </div>
            </AnimateOnScroll>

            {/* Pro Plan (coming soon) */}
            <AnimateOnScroll delay={150}>
              <div className="card-modern-elevated p-8 relative overflow-hidden opacity-80 h-full">
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold bg-brand-navy/10 text-brand-navy">
                  EM BREVE
                </div>
                <h3 className="text-xl font-bold text-brand-navy mb-2">Pro</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-brand-navy">R$ 19</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Tudo do plano Gratis', 'Notificacoes automaticas', 'Integracao bancaria PIX', 'Relatorios avancados', 'Sorteio de times', 'Agenda de jogos integrada', 'Suporte prioritario'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <button disabled className="w-full py-3 px-6 rounded-xl text-sm font-semibold bg-gray-100 text-muted-foreground cursor-not-allowed">
                  Em breve
                </button>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-brand-green/10 text-brand-green mb-4">
              FAQ
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
              Perguntas frequentes
            </h2>
          </AnimateOnScroll>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <AnimateOnScroll key={faq.q} delay={i * 60}>
                <details className="group card-modern-elevated overflow-hidden">
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                    <span className="font-bold text-brand-navy pr-4">{faq.q}</span>
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-open:rotate-180 flex-shrink-0" />
                  </summary>
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                </details>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 gradient-brand-hero animated-gradient text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-green/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
          <AnimateOnScroll animation="fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-tight">
              Pronto para organizar sua pelada?
            </h2>
            <p className="text-white/60 mb-10 text-lg">
              Crie sua conta em segundos e comece a gerenciar a tesouraria do seu grupo agora mesmo.
            </p>
            <Link href="/register" className="btn-modern-green text-lg !px-10 !py-4 inline-flex items-center gap-2 animate-pulse-subtle">
              Criar Conta Gratis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-4 mb-8">
            <div className="md:col-span-2">
              <Logo size="sm" />
              <p className="text-sm text-muted-foreground mt-3 max-w-sm">
                Agora o seu grupo de futebol e uma SAF. Controle mensalidades, despesas e preste contas com transparencia.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-brand-navy text-sm mb-3">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-brand-green transition-colors">Funcionalidades</Link></li>
                <li><Link href="/register" className="hover:text-brand-green transition-colors">Criar Conta</Link></li>
                <li><Link href="/login" className="hover:text-brand-green transition-colors">Entrar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-brand-navy text-sm mb-3">Suporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="cursor-default">contato@peladeiropro.com</span></li>
                <li><span className="cursor-default">WhatsApp</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} PeladeiroPro - trademark Amauri Moleta
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
