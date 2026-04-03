'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface MonthNavigatorProps {
  currentDate: Date
  onChange: (date: Date) => void
}

export function MonthNavigator({ currentDate, onChange }: MonthNavigatorProps) {
  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="flex items-center justify-center gap-4 mb-6">
      <Button variant="outline" size="icon" onClick={() => onChange(subMonths(currentDate, 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-lg font-semibold capitalize min-w-[200px] text-center">{monthLabel}</span>
      <Button variant="outline" size="icon" onClick={() => onChange(addMonths(currentDate, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
