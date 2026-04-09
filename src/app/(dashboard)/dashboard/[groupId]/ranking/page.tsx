'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MonthNavigator } from '@/components/shared/month-navigator'
import {
  Trophy, Target, HandHelping, Crown, Star, ChevronDown, ChevronUp,
  CalendarDays, Medal, Award,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useGroupRole } from '@/hooks/use-group-role'
import type { GroupMember } from '@/lib/types'

interface RankedPlayer {
  memberId: string
  name: string
  total: number
  lastMatch: number | null
}

interface MvpRankedPlayer {
  memberId: string
  name: string
  totalVotes: number
  isLastMvp: boolean
}

function PositionDisplay({ position }: { position: number }) {
  if (position === 1) return <span className="text-lg">🥇</span>
  if (position === 2) return <span className="text-lg">🥈</span>
  if (position === 3) return <span className="text-lg">🥉</span>
  return (
    <span className="flex h-6 w-6 items-center justify-center text-sm font-bold text-muted-foreground">
      {position}
    </span>
  )
}

export default function RankingPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const { role, isAdmin, isReadOnly, loading: roleLoading } = useGroupRole(groupId)

  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterAll, setFilterAll] = useState(true)

  // Data
  const [artilheiros, setArtilheiros] = useState<RankedPlayer[]>([])
  const [assistencias, setAssistencias] = useState<RankedPlayer[]>([])
  const [mvpRanking, setMvpRanking] = useState<MvpRankedPlayer[]>([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [members, setMembers] = useState<GroupMember[]>([])

  // Expand states
  const [expandedArtilheiros, setExpandedArtilheiros] = useState(false)
  const [expandedAssistencias, setExpandedAssistencias] = useState(false)
  const [expandedMvp, setExpandedMvp] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')

      setMembers(membersData || [])
      const memberMap = new Map((membersData || []).map((m: GroupMember) => [m.id, m.name]))

      // Date filter
      const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      // Fetch matches for count
      let matchesQuery = supabase
        .from('matches')
        .select('id, match_date')
        .eq('group_id', groupId)

      if (!filterAll) {
        matchesQuery = matchesQuery.gte('match_date', monthStart).lte('match_date', monthEnd)
      }

      const { data: matchesData } = await matchesQuery.order('match_date', { ascending: false })
      setTotalMatches(matchesData?.length || 0)

      const matchIds = (matchesData || []).map((m: any) => m.id)
      const lastMatchId = matchIds.length > 0 ? matchIds[0] : null

      // Fetch match stats
      let statsQuery = supabase
        .from('match_stats')
        .select('member_id, goals, assists, match_id')
        .eq('group_id', groupId)

      if (!filterAll && matchIds.length > 0) {
        statsQuery = statsQuery.in('match_id', matchIds)
      } else if (!filterAll && matchIds.length === 0) {
        setArtilheiros([])
        setAssistencias([])
        setMvpRanking([])
        setLoading(false)
        return
      }

      const { data: statsData, error: statsError } = await statsQuery

      if (statsError) {
        toast.error('Erro ao carregar estatisticas')
        console.error(statsError)
      }

      // Process artilheiros
      const goalsMap = new Map<string, { total: number; lastMatch: number | null }>()
      const assistsMap = new Map<string, { total: number; lastMatch: number | null }>()

      for (const stat of statsData || []) {
        // Goals
        const goalEntry = goalsMap.get(stat.member_id) || { total: 0, lastMatch: null }
        goalEntry.total += stat.goals || 0
        if (stat.match_id === lastMatchId) {
          goalEntry.lastMatch = stat.goals || 0
        }
        goalsMap.set(stat.member_id, goalEntry)

        // Assists
        const assistEntry = assistsMap.get(stat.member_id) || { total: 0, lastMatch: null }
        assistEntry.total += stat.assists || 0
        if (stat.match_id === lastMatchId) {
          assistEntry.lastMatch = stat.assists || 0
        }
        assistsMap.set(stat.member_id, assistEntry)
      }

      const artilheirosArr: RankedPlayer[] = []
      for (const [memberId, data] of goalsMap) {
        if (data.total > 0) {
          artilheirosArr.push({
            memberId,
            name: memberMap.get(memberId) || 'Desconhecido',
            total: data.total,
            lastMatch: data.lastMatch,
          })
        }
      }
      artilheirosArr.sort((a, b) => b.total - a.total)
      setArtilheiros(artilheirosArr)

      const assistenciasArr: RankedPlayer[] = []
      for (const [memberId, data] of assistsMap) {
        if (data.total > 0) {
          assistenciasArr.push({
            memberId,
            name: memberMap.get(memberId) || 'Desconhecido',
            total: data.total,
            lastMatch: data.lastMatch,
          })
        }
      }
      assistenciasArr.sort((a, b) => b.total - a.total)
      setAssistencias(assistenciasArr)

      // Fetch MVP votes
      let mvpQuery = supabase
        .from('mvp_votes')
        .select('voted_for_id, match_id')
        .eq('group_id', groupId)

      if (!filterAll && matchIds.length > 0) {
        mvpQuery = mvpQuery.in('match_id', matchIds)
      } else if (!filterAll && matchIds.length === 0) {
        setMvpRanking([])
        setLoading(false)
        return
      }

      const { data: mvpData, error: mvpError } = await mvpQuery

      if (mvpError) {
        toast.error('Erro ao carregar votos MVP')
        console.error(mvpError)
      }

      // Count votes per player
      const votesMap = new Map<string, { total: number; lastMatchVotes: number }>()
      for (const vote of mvpData || []) {
        const entry = votesMap.get(vote.voted_for_id) || { total: 0, lastMatchVotes: 0 }
        entry.total += 1
        if (vote.match_id === lastMatchId) {
          entry.lastMatchVotes += 1
        }
        votesMap.set(vote.voted_for_id, entry)
      }

      // Find the last match MVP winner
      let lastMvpId: string | null = null
      if (lastMatchId) {
        let maxVotes = 0
        for (const [memberId, data] of votesMap) {
          if (data.lastMatchVotes > maxVotes) {
            maxVotes = data.lastMatchVotes
            lastMvpId = memberId
          }
        }
      }

      const mvpArr: MvpRankedPlayer[] = []
      for (const [memberId, data] of votesMap) {
        if (data.total > 0) {
          mvpArr.push({
            memberId,
            name: memberMap.get(memberId) || 'Desconhecido',
            totalVotes: data.total,
            isLastMvp: memberId === lastMvpId,
          })
        }
      }
      mvpArr.sort((a, b) => b.totalVotes - a.totalVotes)
      setMvpRanking(mvpArr)
    } catch (err) {
      toast.error('Erro ao carregar ranking')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [groupId, currentDate, filterAll])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const topScorer = artilheiros.length > 0 ? artilheiros[0] : null
  const topMvp = mvpRanking.length > 0 ? mvpRanking[0] : null

  if (loading || roleLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <p className="text-center text-muted-foreground py-12">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-sm">
          <Trophy className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-navy dark:text-gray-100">Ranking</h1>
          <p className="text-sm text-muted-foreground">Gamificacao e estatisticas dos jogadores</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de jogos</p>
                <p className="text-xl font-bold text-brand-navy dark:text-gray-100">{totalMatches}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Artilheiro</p>
                <p className="text-sm font-bold text-brand-navy dark:text-gray-100 truncate">
                  {topScorer ? `${topScorer.name} (${topScorer.total})` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                <Crown className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MVP</p>
                <p className="text-sm font-bold text-brand-navy dark:text-gray-100 truncate">
                  {topMvp ? `${topMvp.name} (${topMvp.totalVotes} votos)` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={filterAll ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterAll(true)}
          >
            Geral
          </Button>
          <Button
            variant={!filterAll ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterAll(false)}
          >
            Por mes
          </Button>
        </div>
        {!filterAll && (
          <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="artilheiros">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="artilheiros" className="text-xs sm:text-sm gap-1 sm:gap-1.5 px-2 sm:px-3">
            <Target className="h-3.5 w-3.5" />
            Artilheiros
          </TabsTrigger>
          <TabsTrigger value="assistencias" className="text-xs sm:text-sm gap-1 sm:gap-1.5 px-2 sm:px-3">
            <HandHelping className="h-3.5 w-3.5" />
            Assistencias
          </TabsTrigger>
          <TabsTrigger value="mvp" className="text-xs sm:text-sm gap-1 sm:gap-1.5 px-2 sm:px-3">
            <Crown className="h-3.5 w-3.5" />
            MVP
          </TabsTrigger>
        </TabsList>

        {/* Artilheiros Tab */}
        <TabsContent value="artilheiros">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-navy dark:text-gray-100">
                <Target className="h-5 w-5 text-brand-green" />
                Artilheiros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {artilheiros.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum gol registrado{!filterAll ? ' neste periodo' : ''}.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-center text-xs font-medium text-muted-foreground px-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="w-10">#</span>
                    <span className="flex-1">Jogador</span>
                    <span className="w-20 text-center">Total</span>
                    <span className="w-24 text-center hidden sm:block">Ultimo jogo</span>
                  </div>

                  {(expandedArtilheiros ? artilheiros : artilheiros.slice(0, 10)).map((player, idx) => (
                    <div
                      key={player.memberId}
                      className={`flex items-center py-2.5 px-2 rounded-lg transition-colors ${
                        idx < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="w-10">
                        <PositionDisplay position={idx + 1} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-brand-navy dark:text-gray-100 truncate block">
                          {player.name}
                        </span>
                      </div>
                      <div className="w-20 text-center">
                        <span className="font-bold text-brand-green">{player.total}</span>
                      </div>
                      <div className="w-24 text-center hidden sm:block">
                        {player.lastMatch !== null ? (
                          <Badge variant="secondary" className="text-xs">
                            {player.lastMatch} gol{player.lastMatch !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {artilheiros.length > 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-brand-navy dark:text-gray-300"
                      onClick={() => setExpandedArtilheiros(!expandedArtilheiros)}
                    >
                      {expandedArtilheiros ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Ver menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Ver todos ({artilheiros.length})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assistencias Tab */}
        <TabsContent value="assistencias">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-navy dark:text-gray-100">
                <HandHelping className="h-5 w-5 text-brand-green" />
                Assistencias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assistencias.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma assistencia registrada{!filterAll ? ' neste periodo' : ''}.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-center text-xs font-medium text-muted-foreground px-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="w-10">#</span>
                    <span className="flex-1">Jogador</span>
                    <span className="w-20 text-center">Total</span>
                    <span className="w-24 text-center hidden sm:block">Ultimo jogo</span>
                  </div>

                  {(expandedAssistencias ? assistencias : assistencias.slice(0, 10)).map((player, idx) => (
                    <div
                      key={player.memberId}
                      className={`flex items-center py-2.5 px-2 rounded-lg transition-colors ${
                        idx < 3 ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="w-10">
                        <PositionDisplay position={idx + 1} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-brand-navy dark:text-gray-100 truncate block">
                          {player.name}
                        </span>
                      </div>
                      <div className="w-20 text-center">
                        <span className="font-bold text-blue-600 dark:text-blue-400">{player.total}</span>
                      </div>
                      <div className="w-24 text-center hidden sm:block">
                        {player.lastMatch !== null ? (
                          <Badge variant="secondary" className="text-xs">
                            {player.lastMatch} assist.
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {assistencias.length > 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-brand-navy dark:text-gray-300"
                      onClick={() => setExpandedAssistencias(!expandedAssistencias)}
                    >
                      {expandedAssistencias ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Ver menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Ver todos ({assistencias.length})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MVP Tab */}
        <TabsContent value="mvp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-navy dark:text-gray-100">
                <Crown className="h-5 w-5 text-yellow-500" />
                Ranking MVP
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mvpRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum voto MVP registrado{!filterAll ? ' neste periodo' : ''}.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-center text-xs font-medium text-muted-foreground px-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="w-10">#</span>
                    <span className="flex-1">Jogador</span>
                    <span className="w-24 text-center">Votos</span>
                  </div>

                  {(expandedMvp ? mvpRanking : mvpRanking.slice(0, 10)).map((player, idx) => (
                    <div
                      key={player.memberId}
                      className={`flex items-center py-2.5 px-2 rounded-lg transition-colors ${
                        idx < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="w-10">
                        <PositionDisplay position={idx + 1} />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="font-medium text-sm text-brand-navy dark:text-gray-100 truncate">
                          {player.name}
                        </span>
                        {player.isLastMvp && (
                          <Badge variant="default" className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white shrink-0">
                            <Star className="h-3 w-3 mr-0.5" />
                            MVP do ultimo jogo
                          </Badge>
                        )}
                      </div>
                      <div className="w-24 text-center">
                        <span className="font-bold text-yellow-600 dark:text-yellow-400">
                          {player.totalVotes} voto{player.totalVotes !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}

                  {mvpRanking.length > 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-brand-navy dark:text-gray-300"
                      onClick={() => setExpandedMvp(!expandedMvp)}
                    >
                      {expandedMvp ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Ver menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Ver todos ({mvpRanking.length})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
