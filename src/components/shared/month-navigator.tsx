'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState, useRef, useEffect, useCallback } from 'react'

interface MonthNavigatorProps {
  currentDate: Date
  onChange: (date: Date) => void
}

const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export function MonthNavigator({ currentDate, onChange }: MonthNavigatorProps) {
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear())
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  // Sync picker year when currentDate changes externally
  useEffect(() => {
    setPickerYear(currentDate.getFullYear())
  }, [currentDate])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleMonthSelect = useCallback(
    (month: number) => {
      const newDate = new Date(pickerYear, month, 1)
      onChange(newDate)
      setOpen(false)
    },
    [pickerYear, onChange],
  )

  const selectedMonth = currentDate.getMonth()
  const selectedYear = currentDate.getFullYear()

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 relative">
      <Button variant="outline" size="icon" className="shrink-0" onClick={() => onChange(subMonths(currentDate, 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm sm:text-lg font-semibold capitalize min-w-0 text-center cursor-pointer
                   rounded-md px-2 sm:px-3 py-1 transition-colors hover:bg-muted/60"
      >
        {monthLabel}
      </button>

      <Button variant="outline" size="icon" className="shrink-0" onClick={() => onChange(addMonths(currentDate, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Month picker popover */}
      <div
        ref={popoverRef}
        className={`absolute top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-[260px] max-w-[260px] left-1/2 -translate-x-1/2
                    rounded-xl border border-border/50 shadow-lg
                    backdrop-blur-xl bg-background/80
                    transition-all duration-200 origin-top
                    ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="p-3">
          {/* Year selector */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setPickerYear((y) => y - 1)}
              className="p-1 rounded-md hover:bg-muted/60 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{pickerYear}</span>
            <button
              type="button"
              onClick={() => setPickerYear((y) => y + 1)}
              className="p-1 rounded-md hover:bg-muted/60 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS_PT.map((label, idx) => {
              const isSelected = idx === selectedMonth && pickerYear === selectedYear
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleMonthSelect(idx)}
                  className={`text-xs font-medium rounded-lg py-2 transition-colors
                    ${
                      isSelected
                        ? 'bg-green-600 text-white'
                        : 'hover:bg-muted/80 text-foreground'
                    }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
