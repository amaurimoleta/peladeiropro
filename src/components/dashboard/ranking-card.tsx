'use client'

import { useEffect, useState } from 'react'
import { Trophy, Medal, Award, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface RankedMember {
  memberId: string
  name: string
  score: number
  badge: 'Craque' | 'Em dia' | 'Irregular' | 'Devedor'
}

function getBadgeVariant(badge: string) {
  switch (badge) {
    case 'Craque':
      return 'default'
    case 'Em dia':
      return 'secondary'
    case 'Irregular':
      return 'outline'
    case 'Devedor':
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

export default function RankingCard({ groupId }: { groupId: string }) {
  const [ranked, setRanked] = useState<RankedMember[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRanking() {
      const supabase = createClient()

      // Check if goalkeeper pays fee
      const { data: group } = await supabase
        .from('groups')
        .select('goalkeeper_pays_fee')
        .eq('id', groupId)
        .single()

      const goalkeeperPaysFee = group?.goalkeeper_pays_fee ?? true

      const { data: allMembers } = await supabase
        .from('group_members')
        .select('id, name, position')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .eq('member_type', 'mensalista')

      // Exclude goalkeepers if they don't pay fees
      const members = !goalkeeperPaysFee
        ? (allMembers || []).filter((m: any) => m.position !== 'goleiro')
        : allMembers

      if (!members || members.length === 0) {
        setLoading(false)
        return
      }

      const memberIds = members.map((m) => m.id)

      const { data: fees } = await supabase
        .from('monthly_fees')
        .select('member_id, status, due_date, paid_at')
        .eq('group_id', groupId)
        .in('member_id', memberIds)

      const memberMap = new Map(members.map((m) => [m.id, m.name]))
      const feesByMember = new Map<string, typeof fees>()
      const today = new Date()

      for (const fee of fees || []) {
        // Exclude DM and waived — they don't count
        if (fee.status === 'dm_leave' || fee.status === 'waived') continue
        // Exclude pending fees whose due_date hasn't passed yet (not yet due)
        if (fee.status === 'pending' && new Date(fee.due_date + 'T23:59:59') > today) continue
        const list = feesByMember.get(fee.member_id) || []
        list.push(fee)
        feesByMember.set(fee.member_id, list)
      }

      const results: RankedMember[] = []

      for (const [memberId, name] of memberMap) {
        const memberFees = feesByMember.get(memberId) || []
        if (memberFees.length === 0) {
          // No relevant fees — new member or all DM/waived, neutral score
          results.push({ memberId, name, score: 50, badge: 'Em dia' })
          continue
        }

        // Score per fee: 100 if on time, penalty by days late
        let totalFeeScore = 0

        for (const fee of memberFees) {
          const dueDate = new Date(fee.due_date + 'T23:59:59')
          if (fee.status === 'paid' && fee.paid_at) {
            const paidDate = new Date(fee.paid_at)
            if (paidDate <= dueDate) {
              // Paid on time — bonus if 2+ days early
              const daysEarly = (dueDate.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24)
              const bonus = daysEarly >= 2 ? Math.min(daysEarly, 10) : 0
              totalFeeScore += 100 + bonus
            } else {
              // Paid late — penalty by days late
              const daysLate = (paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
              totalFeeScore += Math.max(0, 100 - daysLate * 3)
            }
          } else if (fee.status === 'overdue' || (fee.status === 'pending' && dueDate < today)) {
            // Unpaid and overdue — penalty by days overdue
            const daysLate = (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            totalFeeScore += Math.max(0, 100 - daysLate * 3)
          }
        }

        const score = totalFeeScore / memberFees.length

        let badge: RankedMember['badge']
        if (score >= 80) badge = 'Craque'
        else if (score >= 55) badge = 'Em dia'
        else if (score >= 25) badge = 'Irregular'
        else badge = 'Devedor'

        results.push({ memberId, name, score: Math.round(score * 10) / 10, badge })
      }

      results.sort((a, b) => b.score - a.score)
      setRanked(results)
      setLoading(false)
    }

    fetchRanking()
  }, [groupId])

  const displayed = expanded ? ranked : ranked.slice(0, 5)

  return (
    <div className="card-modern-elevated p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-sm">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <h2 className="font-bold text-[#1B1F4B]">Ranking de Pagadores</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Carregando ranking...</p>
      ) : ranked.length === 0 ? (
        <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-sm">Nenhum mensalista encontrado.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {displayed.map((member, idx) => {
              const position = ranked.indexOf(member) + 1
              return (
                <div key={member.memberId} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-3">
                    <PositionIcon position={position} />
                    <span className="font-medium text-[#1B1F4B]">{member.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getBadgeVariant(member.badge)}>{member.badge}</Badge>
                    <span className="text-xs font-semibold text-muted-foreground w-10 text-right">
                      {member.score}
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
