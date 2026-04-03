'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Shuffle, Copy, Users } from 'lucide-react'
import { toast } from 'sonner'

interface Member {
  id: string
  name: string
}

interface TeamShuffleProps {
  members: Member[]
}

const TEAM_COLORS = [
  { name: 'Time 1', bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', emoji: '🟢' },
  { name: 'Time 2', bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', emoji: '🔵' },
  { name: 'Time 3', bg: 'from-red-500 to-red-600', light: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', emoji: '🔴' },
  { name: 'Time 4', bg: 'from-orange-500 to-orange-600', light: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', emoji: '🟠' },
]

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function distributeIntoTeams(members: Member[], numTeams: number): Member[][] {
  const shuffled = shuffleArray(members)
  const teams: Member[][] = Array.from({ length: numTeams }, () => [])

  shuffled.forEach((member, index) => {
    teams[index % numTeams].push(member)
  })

  return teams
}

export function TeamShuffle({ members }: TeamShuffleProps) {
  const [open, setOpen] = useState(false)
  const [numTeams, setNumTeams] = useState(2)
  const [teams, setTeams] = useState<Member[][] | null>(null)
  const [isShuffling, setIsShuffling] = useState(false)
  const [shuffleKey, setShuffleKey] = useState(0)

  const handleShuffle = useCallback(() => {
    setIsShuffling(true)
    setTeams(null)

    // Brief animation delay before revealing results
    setTimeout(() => {
      const result = distributeIntoTeams(members, numTeams)
      setTeams(result)
      setShuffleKey((k) => k + 1)
      setIsShuffling(false)
    }, 600)
  }, [members, numTeams])

  const handleShare = useCallback(() => {
    if (!teams) return

    const lines = ['⚽ Sorteio de Times', '']

    teams.forEach((team, index) => {
      const color = TEAM_COLORS[index]
      const playerCount = team.length
      const label = playerCount === 1 ? '1 jogador' : `${playerCount} jogadores`
      lines.push(`${color.emoji} ${color.name} (${label}):`)
      team.forEach((member) => {
        lines.push(`- ${member.name}`)
      })
      lines.push('')
    })

    const text = lines.join('\n').trim()

    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copiado para a área de transferência!')
    }).catch(() => {
      toast.error('Não foi possível copiar o texto.')
    })
  }, [teams])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setTeams(null)
      setIsShuffling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2">
            <Shuffle className="size-4" />
            Sortear Times
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shuffle className="size-5 text-brand-green" />
            Sorteio de Times
          </DialogTitle>
          <DialogDescription>
            {members.length} jogadores presentes. Escolha o número de times e sorteie!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Number of teams selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Número de times
            </label>
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setNumTeams(n)
                    setTeams(null)
                  }}
                  className={`
                    flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200
                    ${numTeams === n
                      ? 'gradient-green text-white shadow-md scale-105'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }
                  `}
                >
                  {n} times
                </button>
              ))}
            </div>
          </div>

          {/* Shuffle button */}
          <Button
            onClick={handleShuffle}
            disabled={isShuffling || members.length < numTeams}
            className="w-full btn-modern-green h-11 text-base gap-2 rounded-xl border-0"
          >
            <Shuffle
              className={`size-5 ${isShuffling ? 'animate-spin' : ''}`}
            />
            {teams ? 'Sortear Novamente' : 'Sortear!'}
          </Button>

          {members.length < numTeams && (
            <p className="text-xs text-destructive text-center">
              Precisa de pelo menos {numTeams} jogadores para {numTeams} times.
            </p>
          )}

          {/* Results */}
          {teams && (
            <div className="space-y-3" key={shuffleKey}>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {teams.map((team, index) => {
                  const color = TEAM_COLORS[index]
                  const playerCount = team.length
                  const label = playerCount === 1 ? '1 jogador' : `${playerCount} jogadores`

                  return (
                    <div
                      key={index}
                      className={`
                        card-modern-elevated overflow-hidden
                        animate-fade-in-up
                      `}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Card header with gradient */}
                      <div className={`bg-gradient-to-r ${color.bg} px-4 py-2.5 flex items-center justify-between`}>
                        <span className="text-white font-heading font-semibold text-sm">
                          {color.emoji} {color.name}
                        </span>
                        <span className="flex items-center gap-1 text-white/80 text-xs">
                          <Users className="size-3" />
                          {label}
                        </span>
                      </div>
                      {/* Player list */}
                      <div className={`px-4 py-3 space-y-1.5 ${color.light}`}>
                        {team.map((member, memberIdx) => (
                          <div
                            key={member.id}
                            className={`
                              flex items-center gap-2 text-sm
                              animate-fade-in-left
                            `}
                            style={{ animationDelay: `${index * 100 + memberIdx * 50 + 200}ms` }}
                          >
                            <span className={`size-6 rounded-full bg-gradient-to-r ${color.bg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                              {memberIdx + 1}
                            </span>
                            <span className={`font-medium ${color.text}`}>
                              {member.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Share button */}
              <Button
                onClick={handleShare}
                variant="outline"
                className="w-full gap-2"
              >
                <Copy className="size-4" />
                Compartilhar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
