'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarDays,
  Settings,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { GroupSelector } from '@/components/dashboard/group-selector'

const navItems = [
  { href: '', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/matches', icon: CalendarDays, label: 'Jogos' },
  { href: '/members', icon: Users, label: 'Membros' },
  { href: '/financeiro', icon: CreditCard, label: 'Financeiro' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
]

export function Sidebar({ groupId, groupName }: { groupId: string; groupName: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        setUserName(profile?.full_name || user.email || null)
      }
    }
    fetchUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nav = (
    <nav className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
        <Link href="/dashboard">
          <Logo size="sm" variant={resolvedTheme === 'dark' ? 'white' : 'dark'} />
        </Link>
        <GroupSelector currentGroupId={groupId} currentGroupName={groupName} />
      </div>
      <div className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const fullHref = `/dashboard/${groupId}${item.href}`
          const isActive = item.href === ''
            ? pathname === `/dashboard/${groupId}`
            : pathname.startsWith(fullHref)
          return (
            <Link
              key={item.href}
              href={fullHref}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-brand-green/10 to-brand-green/5 text-brand-green shadow-sm'
                  : 'text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-brand-navy dark:hover:text-gray-200'
              )}
            >
              <item.icon className={cn('h-4 w-4', isActive && 'text-brand-green')} />
              {item.label}
            </Link>
          )
        })}
      </div>
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
        {userName && (
          <div className="px-3 py-1 mb-1">
            <p className="text-xs text-muted-foreground truncate">{userName}</p>
          </div>
        )}
        <Link
          href="/dashboard/profile"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            pathname === '/dashboard/profile'
              ? 'bg-gradient-to-r from-brand-green/10 to-brand-green/5 text-brand-green shadow-sm'
              : 'text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-brand-navy dark:hover:text-gray-200'
          )}
        >
          <User className="h-4 w-4" />
          Meu Perfil
        </Link>
        <div className="flex items-center gap-3 px-3 py-1">
          <ThemeToggle />
          <span className="text-sm font-medium text-muted-foreground">Tema</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 w-full transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </nav>
  )

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm rounded-xl"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-r border-gray-100 dark:border-gray-800 shadow-2xl transform transition-transform duration-300 ease-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {nav}
      </aside>

      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl h-screen sticky top-0">
        {nav}
      </aside>
    </>
  )
}
