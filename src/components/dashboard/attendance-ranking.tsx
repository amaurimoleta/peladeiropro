'use client'

import { useEffect, useState } from 'react'
import { Trophy, Medal, Award, UserCheck, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface RankedMember {
  memberId: string
  name: string
  totalMatches: number
  attended: number
  percentage: number
  badge: 'Craque' | 'Comprometido' | 'Irregular' | 'Sumido'
}

function getAttendanceBadgeVariant(badge: string) {
  switch (badge) {
    case 'Craque':
      return 'default'
    case 'Comprometido':
      return 'secondary'
    case 'Irregular':
      return 'outline'
    case 'Sumido':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function PositionIcon({ position }: { position: number }) {
  if (position === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
  if (position === 2) return <Medal className="h-5 w-5 text-gray-400" />
  if (position === 3) return <Award className="h-5 w-5 text-amber-600" />
  return (
    <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-muted-foreground">
      {position}
    </span>
  )
}

export function AttendanceRanking({ groupId }: { groupId: string }) {
  const [ranked, setRanked] = useState<RankedMember[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRanking() {
      const supabase = createClient()

      // Get active members
      const { data: members } = await supabase
        .from('group_members')
        .select('id, name')
        .eq('group_id', groupId)
        .eq('status', 'active')

      if (!members || members.length === 0) {
        setLoading(false)
        return
      }

      // Get all matches for this group
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('group_id', groupId)

      if (!matches || matches.length === 0) {
        setLoading(false)
        return
      }

      const matchIds = matches.map((m) => m.id)
      const totalMatches = matchIds.length

      // Get all attendance records for these matches
      const { data: attendance } = await supabase
        .from('match_attendance')
        .select('member_id, present')
        .in('match_id', matchIds)

      const memberMap = new Map(members.map((m) => [m.id, m.name]))

      // Count attendance per member
      const attendanceByMember = new Map<string, number>()
      for (const record of attendance || []) {
        if (record.present) {
          attendanceByMember.set(
            record.member_id,
            (attendanceByMember.get(record.member_id) || 0) + 1
          )
        }
      }

      const results: RankedMember[] = []

      for (const [memberId, name] of memberMap) {
        const attended = attendanceByMember.get(memberId) || 0
        const percentage = totalMatches > 0 ? Math.round((attended / totalMatches) * 100) : 0

        let badge: RankedMember['badge']
        if (percentage >= 90) badge = 'Craque'
        else if (percentage >= 70) badge = 'Comprometido'
        else if (percentage >= 40) badge = 'Irregular'
        else badge = 'Sumido'

        results.push({ memberId, name, totalMatches, attended, percentage, badge })
      }

      results.sort((a, b) => b.percentage - a.percentage || b.attended - a.attended)
      setRanked(results)
      setLoading(false)
    }

    fetchRanking()
  }, [groupId])

  const displayed = expanded ? ranked : ranked.slice(0, 5)

  return (
    <div className="card-modern-elevated p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
          <UserCheck className="h-4 w-4 text-white" />
        </div>
        <h2 className="font-bold text-[#1B1F4B]">Ranking de Presenca</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Carregando ranking...</p>
      ) : ranked.length === 0 ? (
        <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-sm">Nenhum registro de presenca encontrado.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayed.map((member) => {
              const position = ranked.indexOf(member) + 1
              return (
                <div key={member.memberId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <PositionIcon position={position} />
                      <span className="font-medium text-[#1B1F4B]">{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getAttendanceBadgeVariant(member.badge)}>
                        {member.badge}
                      </Badge>
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {member.attended}/{member.totalMatches} jogos
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 pl-8">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${member.percentage}%`,
                          background:
                            member.percentage >= 90
                              ? 'linear-gradient(90deg, #00C853, #00E676)'
                              : member.percentage >= 70
                                ? 'linear-gradient(90deg, #2196F3, #42A5F5)'
                                : member.percentage >= 40
                                  ? 'linear-gradient(90deg, #FF9800, #FFB74D)'
                                  : 'linear-gradient(90deg, #F44336, #EF5350)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground w-10 text-right">
                      {member.percentage}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {ranked.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-[#1B1F4B]"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Ver todos
                </>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
