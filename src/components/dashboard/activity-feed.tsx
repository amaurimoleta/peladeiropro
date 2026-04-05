'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  DollarSign,
  Users,
  Settings,
  Trash2,
  Plus,
  Edit,
  Clock,
  Activity,
  CreditCard,
  Receipt,
  UserPlus,
  Shield,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { AuditLog } from '@/lib/types'

const PAGE_SIZE = 20

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `ha ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `ha ${hours} hora${hours > 1 ? 's' : ''}`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 30) return `ha ${days} dias`

  const months = Math.floor(days / 30)
  return `ha ${months} ${months === 1 ? 'mes' : 'meses'}`
}

interface ActionConfig {
  icon: React.ComponentType<{ className?: string }>
  color: string
  dotColor: string
  bgColor: string
  darkBgColor: string
}

const ACTION_MAP: Record<string, ActionConfig> = {
  payment_recorded: {
    icon: DollarSign,
    color: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    darkBgColor: 'dark:bg-emerald-500/10',
  },
  fee_paid: {
    icon: DollarSign,
    color: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    darkBgColor: 'dark:bg-emerald-500/10',
  },
  expense_added: {
    icon: Receipt,
    color: 'text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50',
    darkBgColor: 'dark:bg-red-500/10',
  },
  expense_deleted: {
    icon: Receipt,
    color: 'text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50',
    darkBgColor: 'dark:bg-red-500/10',
  },
  member_added: {
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-500/10',
  },
  member_removed: {
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-500/10',
  },
  settings_updated: {
    icon: Settings,
    color: 'text-purple-600 dark:text-purple-400',
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    darkBgColor: 'dark:bg-purple-500/10',
  },
  guest_added: {
    icon: UserPlus,
    color: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    darkBgColor: 'dark:bg-amber-500/10',
  },
}

const DEFAULT_ACTION: ActionConfig = {
  icon: Activity,
  color: 'text-gray-600 dark:text-gray-400',
  dotColor: 'bg-gray-400',
  bgColor: 'bg-gray-50',
  darkBgColor: 'dark:bg-gray-500/10',
}

function getActionConfig(action: string): ActionConfig {
  return ACTION_MAP[action] || DEFAULT_ACTION
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    payment_recorded: 'Pagamento registrado',
    fee_paid: 'Mensalidade paga',
    expense_added: 'Despesa adicionada',
    expense_deleted: 'Despesa removida',
    member_added: 'Membro adicionado',
    member_removed: 'Membro removido',
    settings_updated: 'Configuracoes atualizadas',
    guest_added: 'Convidado adicionado',
    create: 'Item criado',
    update: 'Item atualizado',
    delete: 'Item removido',
    pin: 'Item fixado',
    unpin: 'Item desafixado',
  }
  return labels[action] || action.replace(/_/g, ' ')
}

export default function ActivityFeed({ groupId }: { groupId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const supabase = createClient()

  const fetchLogs = useCallback(
    async (offset = 0, append = false) => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        console.error('Erro ao buscar atividades:', error)
        if (!append) setLoading(false)
        setLoadingMore(false)
        return
      }

      const entries = data || []

      if (append) {
        setLogs((prev) => {
          const existingIds = new Set(prev.map((l) => l.id))
          const newEntries = entries.filter((e) => !existingIds.has(e.id))
          return [...prev, ...newEntries]
        })
      } else {
        setLogs(entries)
      }

      setHasMore(entries.length === PAGE_SIZE)
      setLoading(false)
      setLoadingMore(false)

      // Animate new entries
      setTimeout(() => {
        entries.forEach((entry, i) => {
          setTimeout(() => {
            setVisibleItems((prev) => new Set(prev).add(entry.id))
          }, i * 60)
        })
      }, 50)
    },
    [groupId]
  )

  useEffect(() => {
    fetchLogs()

    intervalRef.current = setInterval(() => {
      fetchLogs()
    }, 30000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchLogs])

  function handleLoadMore() {
    setLoadingMore(true)
    fetchLogs(logs.length, true)
  }

  return (
    <div className="card-modern-elevated p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
          <Activity className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-[#1B1F4B] dark:text-gray-100">
            Atividades Recentes
          </h2>
          <p className="text-xs text-muted-foreground">
            Atualiza automaticamente
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
          <p className="text-sm text-muted-foreground">
            Carregando atividades...
          </p>
        </div>
      ) : logs.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Clock className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">Nenhuma atividade registrada</p>
          <p className="text-xs mt-1">
            As acoes do grupo aparecerao aqui
          </p>
        </div>
      ) : (
        /* Timeline */
        <>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border dark:bg-gray-700" />

            <div className="space-y-1">
              {logs.map((log) => {
                const config = getActionConfig(log.action)
                const Icon = config.icon
                const isVisible = visibleItems.has(log.id)

                // Build details string
                let detailText = ''
                if (log.details) {
                  if (typeof log.details === 'string') {
                    detailText = log.details
                  } else if (typeof log.details === 'object') {
                    const d = log.details as Record<string, any>
                    const parts: string[] = []
                    if (d.member_name) parts.push(d.member_name)
                    if (d.name) parts.push(d.name)
                    if (d.title) parts.push(d.title)
                    if (d.description) parts.push(d.description)
                    if (d.amount != null)
                      parts.push(
                        `R$ ${Number(d.amount).toFixed(2).replace('.', ',')}`
                      )
                    if (d.reference_month) parts.push(d.reference_month)
                    detailText = parts.join(' - ')
                  }
                }

                return (
                  <div
                    key={log.id}
                    className={`
                      relative flex items-start gap-3 pl-0 py-2 rounded-lg
                      transition-all duration-500 ease-out
                      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                    `}
                  >
                    {/* Timeline dot + icon */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={`
                          h-[31px] w-[31px] rounded-full flex items-center justify-center
                          ${config.bgColor} ${config.darkBgColor}
                          ring-2 ring-white dark:ring-[#1e2235]
                        `}
                      >
                        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1B1F4B] dark:text-gray-200 leading-snug">
                            {getActionLabel(log.action)}
                          </p>
                          {detailText && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {detailText}
                            </p>
                          )}
                          {log.user_name && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              por {log.user_name}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0 pt-0.5">
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Load More */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-4 text-[#1B1F4B] dark:text-gray-300"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Ver mais
                </>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
