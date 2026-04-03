'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, TrendingUp, AlertTriangle } from 'lucide-react'

interface RankedMember {
  name: string
  memberId: string
  memberType: string
  totalFees: number
  paidOnTime: number
  paidLate: number
  unpaid: number
  avgDaysEarly: number
  score: number
}

export default function RankingPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const [ranking, setRanking] = useState<RankedMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRanking() {
      const [{ data: members }, { data: fees }] = await Promise.all([
        supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'active'),
        supabase.from('monthly_fees').select('*').eq('group_id', groupId),
      ])

      if (!members || !fees) { setLoading(false); return }

      // Only rank mensalistas
      const mensalistas = members.filter(m => m.member_type === 'mensalista')

      const ranked: RankedMember[] = mensalistas.map(member => {
        const memberFees = fees.filter(f => f.member_id === member.id)
        // Exclude dm_leave and waived from scoring
        const scorableFees = memberFees.filter(f => f.status !== 'dm_leave' && f.status !== 'waived')
        const paidFees = scorableFees.filter(f => f.status === 'paid')
        const unpaidFees = scorableFees.filter(f => f.status === 'pending' || f.status === 'overdue')

        let totalDaysEarly = 0
        let paidOnTime = 0
        let paidLate = 0

        paidFees.forEach(f => {
          if (f.paid_at && f.due_date) {
            const dueDate = new Date(f.due_date + 'T23:59:59')
            const paidDate = new Date(f.paid_at)
            const diffDays = Math.floor((dueDate.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24))
            totalDaysEarly += diffDays
            if (diffDays >= 0) paidOnTime++
            else paidLate++
          }
        })

        const avgDaysEarly = paidFees.length > 0 ? totalDaysEarly / paidFees.length : 0
        const onTimeRate = scorableFees.length > 0 ? (paidOnTime / scorableFees.length) : 0
        const score = scorableFees.length > 0
          ? Math.round(onTimeRate * 70 + Math.min(avgDaysEarly, 10) * 3)
          : 0

        const dmCount = memberFees.filter(f => f.status === 'dm_leave').length

        return {
          name: member.name,
          memberId: member.id,
          memberType: member.member_type,
          totalFees: scorableFees.length,
          paidOnTime,
          paidLate,
          unpaid: unpaidFees.length,
          avgDaysEarly: Math.round(avgDaysEarly * 10) / 10,
          score,
        }
      })

      ranked.sort((a, b) => b.score - a.score)
      setRanking(ranked)
      setLoading(false)
    }

    loadRanking()
  }, [groupId])

  function getBadge(index: number, score: number) {
    if (score === 0) return <Badge variant="secondary">Sem dados</Badge>
    if (index === 0) return <Badge className="bg-yellow-400 text-yellow-900">Craque do Pagamento</Badge>
    if (score >= 70) return <Badge className="bg-[#00C853]/10 text-[#00C853]">Em dia</Badge>
    if (score >= 40) return <Badge className="bg-amber-100 text-amber-700">Irregular</Badge>
    return <Badge variant="destructive">Devedor</Badge>
  }

  function getIcon(index: number) {
    if (index === 0) return <Trophy className="h-6 w-6 text-yellow-500" />
    if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />
    if (index === 2) return <Award className="h-6 w-6 text-amber-600" />
    return <span className="h-6 w-6 flex items-center justify-center text-sm font-bold text-muted-foreground">{index + 1}</span>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B1F4B]">Ranking de Pagadores</h1>
        <p className="text-muted-foreground">Quem paga em dia sobe no ranking! (Apenas mensalistas)</p>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando ranking...</CardContent></Card>
      ) : ranking.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sem dados de pagamento ainda.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {ranking.map((member, index) => (
            <Card key={member.memberId} className={index === 0 && member.score > 0 ? 'border-yellow-300 bg-yellow-50/50' : ''}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-shrink-0">
                  {getIcon(index)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[#1B1F4B] truncate">{member.name}</span>
                    {getBadge(index, member.score)}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-[#00C853]" />
                      {member.paidOnTime} em dia
                    </span>
                    {member.paidLate > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {member.paidLate} atrasado{member.paidLate > 1 ? 's' : ''}
                      </span>
                    )}
                    {member.unpaid > 0 && (
                      <span className="text-red-500">{member.unpaid} pendente{member.unpaid > 1 ? 's' : ''}</span>
                    )}
                    {member.avgDaysEarly > 0 && (
                      <span>{member.avgDaysEarly}d de antecedencia</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold text-[#1B1F4B]">{member.score}</div>
                  <div className="text-xs text-muted-foreground">pontos</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
