'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CalendarDays, Calendar } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  currentMonth: string // yyyy-MM
  viewMode: 'month' | 'year'
}

export function DashboardNav({ currentMonth, viewMode }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const date = new Date(currentMonth + '-15T12:00:00')
  const year = parseInt(currentMonth.split('-')[0])

  function navigate(month: string, mode: string) {
    const params = new URLSearchParams()
    params.set('mes', month)
    if (mode === 'year') params.set('visao', 'ano')
    router.push(`${pathname}?${params.toString()}`)
  }

  if (viewMode === 'year') {
    return (
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`${year - 1}-01`, 'year')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-bold text-brand-navy min-w-[80px] text-center">
          {year}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`${year + 1}-01`, 'year')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(currentMonth, 'month')}
        >
          <CalendarDays className="h-4 w-4 mr-1" /> Mensal
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-4 mb-6">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() =>
          navigate(format(subMonths(date, 1), 'yyyy-MM'), 'month')
        }
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-lg font-bold text-brand-navy capitalize min-w-[160px] text-center">
        {format(date, 'MMMM yyyy', { locale: ptBR })}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() =>
          navigate(format(addMonths(date, 1), 'yyyy-MM'), 'month')
        }
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`${year}-01`, 'year')}
      >
        <Calendar className="h-4 w-4 mr-1" /> Anual
      </Button>
    </div>
  )
}
