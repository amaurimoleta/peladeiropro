'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Check, Clock, AlertCircle, Stethoscope, Upload, Trophy, Medal, Award,
  TrendingUp, DollarSign, Calendar, Eye, Image, CalendarCheck, Percent,
  ChevronDown, ChevronUp, UserCheck, UserX, MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { uploadReceipt } from '@/lib/upload-receipt'
import { logAudit } from '@/lib/audit'
import { PixQrCode } from '@/components/shared/pix-qrcode'
import type { Group, GroupMember, MonthlyFee } from '@/lib/types'

interface RankedInfo {
  position: number
  score: number
  badge: string
  totalMembers: number
}

export default function MinhaAreaPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [member, setMember] = useState<GroupMember | null>(null)
  const [fees, setFees] = useState<MonthlyFee[]>([])
  const [ranking, setRanking] = useState<RankedInfo | null>(null)
  const [attendanceStats, setAttendanceStats] = useState({ total: 0, present: 0 })
  const [showAllFees, setShowAllFees] = useState(false)
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([])
  const [myConfirmations, setMyConfirmations] = useState<Record<string, string>>({})

  // Receipt upload
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadingFeeId, setUploadingFeeId] = useState<string | null>(null)
  const [uploadingFeeMonth, setUploadingFeeMonth] = useState<string>('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Receipt viewer
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null)

  // PIX dialog
  const [pixDialogOpen, setPixDialogOpen] = useState(false)
  const [pixAmount, setPixAmount] = useState<number>(0)

  const loadData = useCallback(async () => {
    setLoading(true)

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Get group info
    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single()
    setGroup(groupData)

    // Find my member record
    const { data: memberData } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .single()

    if (!memberData) {
      setLoading(false)
      return
    }
    setMember(memberData)

    // Get my fees (all months)
    const { data: feesData } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('group_id', groupId)
      .eq('member_id', memberData.id)
      .order('reference_month', { ascending: false })
    setFees(feesData || [])

    // Get attendance stats
    const { data: attendanceData } = await supabase
      .from('match_attendance')
      .select('present')
      .eq('member_id', memberData.id)

    if (attendanceData) {
      setAttendanceStats({
        total: attendanceData.length,
        present: attendanceData.filter(a => a.present).length,
      })
    }

    // Get upcoming matches (today and future)
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: matchesData } = await supabase
      .from('matches')
      .select('id, match_date, location, notes, max_players')
      .eq('group_id', groupId)
      .gte('match_date', todayStr)
      .order('match_date', { ascending: true })
      .limit(5)

    if (matchesData && matchesData.length > 0) {
      setUpcomingMatches(matchesData)
      // Load confirmations for upcoming matches
      const matchIds = matchesData.map(m => m.id)
      const { data: confsData } = await supabase
        .from('match_confirmations')
        .select('match_id, member_id, status, member:group_members(name)')
        .in('match_id', matchIds)

      if (confsData) {
        const myConfs: Record<string, string> = {}
        const matchConfs: Record<string, any[]> = {}
        for (const c of confsData) {
          if (c.member_id === memberData.id) {
            myConfs[c.match_id] = c.status
          }
          if (!matchConfs[c.match_id]) matchConfs[c.match_id] = []
          matchConfs[c.match_id].push(c)
        }
        setMyConfirmations(myConfs)
        // Store per-match confirmations for counts
        setUpcomingMatches(prev => prev.map(m => ({
          ...m,
          confirmations: matchConfs[m.id] || [],
        })))
      }
    }

    // Calculate ranking position
    await calculateRanking(memberData.id, groupData)

    setLoading(false)
  }, [groupId])

  async function calculateRanking(myMemberId: string, groupData: any) {
    const goalkeeperPaysFee = groupData?.goalkeeper_pays_fee ?? true

    const { data: allMembers } = await supabase
      .from('group_members')
      .select('id, name, position')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .eq('member_type', 'mensalista')

    const members = !goalkeeperPaysFee
      ? (allMembers || []).filter((m: any) => m.position !== 'goleiro')
      : allMembers

    if (!members || members.length === 0) return

    const memberIds = members.map(m => m.id)
    const { data: allFees } = await supabase
      .from('monthly_fees')
      .select('member_id, status, due_date, paid_at, reference_month')
      .eq('group_id', groupId)
      .in('member_id', memberIds)

    const today = new Date()
    const feesByMember = new Map<string, any[]>()

    for (const fee of allFees || []) {
      if (fee.status === 'dm_leave' || fee.status === 'waived') continue
      if (fee.status === 'pending' && new Date(fee.due_date + 'T23:59:59') > today) continue
      const list = feesByMember.get(fee.member_id) || []
      list.push(fee)
      feesByMember.set(fee.member_id, list)
    }

    const scores: { memberId: string; score: number }[] = []

    for (const m of members) {
      const memberFees = feesByMember.get(m.id) || []
      if (memberFees.length === 0) {
        scores.push({ memberId: m.id, score: 100 })
        continue
      }

      const sorted = [...memberFees].sort((a, b) =>
        (a.reference_month || '').localeCompare(b.reference_month || '')
      )

      let totalWeightedScore = 0
      let totalWeight = 0

      sorted.forEach((fee, index) => {
        const weight = index + 1
        const dueDate = new Date(fee.due_date + 'T23:59:59')
        let feeScore = 0

        if (fee.status === 'paid' && fee.paid_at) {
          const paidDate = new Date(fee.paid_at)
          if (paidDate <= dueDate) {
            const daysEarly = (dueDate.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24)
            const bonus = daysEarly >= 2 ? Math.min(daysEarly, 10) : 0
            feeScore = 100 + bonus
          } else {
            const daysLate = (paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            feeScore = Math.max(0, 100 - daysLate * 3)
          }
        } else if (fee.status === 'overdue' || (fee.status === 'pending' && dueDate < today)) {
          const daysLate = (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          feeScore = Math.max(0, 100 - daysLate * 3)
        }

        totalWeightedScore += feeScore * weight
        totalWeight += weight
      })

      const score = totalWeight > 0 ? totalWeightedScore / totalWeight : 100
      scores.push({ memberId: m.id, score: Math.round(score * 10) / 10 })
    }

    scores.sort((a, b) => b.score - a.score)
    const myIndex = scores.findIndex(s => s.memberId === myMemberId)
    if (myIndex >= 0) {
      const myScore = scores[myIndex].score
      let badge: string
      if (myScore > 100) badge = 'Artilheiro'
      else if (myScore >= 95) badge = 'Titular'
      else if (myScore >= 80) badge = 'Catimbeiro'
      else if (myScore >= 50) badge = 'Pendurado'
      else badge = 'Rebaixado'

      setRanking({
        position: myIndex + 1,
        score: myScore,
        badge,
        totalMembers: scores.length,
      })
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  function openUploadDialog(feeId: string, month: string, amount: number) {
    setUploadingFeeId(feeId)
    setUploadingFeeMonth(month)
    setReceiptFile(null)
    setPixAmount(amount)
    setUploadDialogOpen(true)
  }

  async function submitReceipt() {
    if (!uploadingFeeId || !receiptFile) return
    setUploading(true)

    const receiptUrl = await uploadReceipt(supabase, receiptFile, groupId)
    if (!receiptUrl) {
      toast.error('Erro ao enviar comprovante')
      setUploading(false)
      return
    }

    const { error } = await supabase
      .from('monthly_fees')
      .update({ receipt_url: receiptUrl })
      .eq('id', uploadingFeeId)

    if (error) {
      toast.error('Erro ao salvar comprovante')
    } else {
      toast.success('Comprovante enviado! Aguarde a confirmacao do tesoureiro.')
      await logAudit(supabase, {
        groupId,
        action: 'member_upload_receipt',
        entityType: 'monthly_fee',
        entityId: uploadingFeeId,
        details: { member: member?.name, month: uploadingFeeMonth },
      })
      loadData()
    }
    setUploading(false)
    setUploadDialogOpen(false)
    setReceiptFile(null)
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20"><Check className="h-3 w-3 mr-1" />Pago</Badge>
      case 'overdue':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Atrasado</Badge>
      case 'waived':
        return <Badge variant="secondary">Dispensado</Badge>
      case 'dm_leave':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"><Stethoscope className="h-3 w-3 mr-1" />DM</Badge>
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
    }
  }

  function PositionIcon({ position }: { position: number }) {
    if (position === 1) return <Trophy className="h-6 w-6 text-yellow-500" />
    if (position === 2) return <Medal className="h-6 w-6 text-gray-400" />
    if (position === 3) return <Award className="h-6 w-6 text-amber-600" />
    return (
      <span className="flex h-6 w-6 items-center justify-center text-lg font-bold text-muted-foreground">
        {position}º
      </span>
    )
  }

  function badgeColor(badge: string) {
    switch (badge) {
      case 'Artilheiro': return 'text-yellow-600'
      case 'Titular': return 'text-[#00C853]'
      case 'Catimbeiro': return 'text-amber-500'
      case 'Pendurado': return 'text-orange-500'
      case 'Rebaixado': return 'text-red-500'
      default: return 'text-muted-foreground'
    }
  }

  function badgeBg(badge: string) {
    switch (badge) {
      case 'Artilheiro': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
      case 'Titular': return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
      case 'Catimbeiro': return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
      case 'Pendurado': return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
      case 'Rebaixado': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  // Match RSVP
  async function toggleMatchConfirmation(matchId: string, status: 'confirmed' | 'declined') {
    if (!member) return
    const current = myConfirmations[matchId]

    if (current === status) {
      // Remove
      await supabase.from('match_confirmations').delete()
        .eq('match_id', matchId).eq('member_id', member.id)
      setMyConfirmations(prev => { const n = { ...prev }; delete n[matchId]; return n })
    } else if (current) {
      // Update
      await supabase.from('match_confirmations').update({ status })
        .eq('match_id', matchId).eq('member_id', member.id)
      setMyConfirmations(prev => ({ ...prev, [matchId]: status }))
    } else {
      // Insert
      await supabase.from('match_confirmations').insert({
        match_id: matchId, member_id: member.id, status,
      })
      setMyConfirmations(prev => ({ ...prev, [matchId]: status }))
    }
    // Reload confirmations for this match
    const { data } = await supabase
      .from('match_confirmations')
      .select('match_id, member_id, status, member:group_members(name)')
      .eq('match_id', matchId)
    setUpcomingMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, confirmations: data || [] } : m
    ))
  }

  // Computed
  const paidFees = fees.filter(f => f.status === 'paid')
  const pendingFees = fees.filter(f => f.status === 'pending' || f.status === 'overdue')
  const totalPaid = paidFees.reduce((sum, f) => sum + Number(f.amount), 0)
  const totalPending = pendingFees.reduce((sum, f) => sum + Number(f.amount), 0)
  const displayedFees = showAllFees ? fees : fees.slice(0, 6)
  const attendancePct = attendanceStats.total > 0
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-muted-foreground">Voce nao possui um perfil de membro neste grupo.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B1F4B]">Minha Area</h1>
        <p className="text-muted-foreground">Acompanhe seus pagamentos, ranking e presenca</p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Ranking Card */}
        <Card className="border-2 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4 pb-4 text-center">
            {ranking ? (
              <>
                <PositionIcon position={ranking.position} />
                <p className={`text-lg font-bold mt-1 ${badgeColor(ranking.badge)}`}>
                  {ranking.badge}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ranking.position}º de {ranking.totalMembers} &bull; Score {ranking.score}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-2">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Fees Paid */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-full bg-[#00C853]/10 p-1.5">
                <Check className="h-3.5 w-3.5 text-[#00C853]" />
              </div>
              <span className="text-xs text-muted-foreground">Pagas</span>
            </div>
            <p className="text-xl font-bold text-[#00C853]">{paidFees.length}</p>
            <p className="text-xs text-muted-foreground">R$ {totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>

        {/* Fees Pending */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-full bg-red-500/10 p-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              </div>
              <span className="text-xs text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-xl font-bold text-red-500">{pendingFees.length}</p>
            <p className="text-xs text-muted-foreground">R$ {totalPending.toFixed(2)}</p>
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-full bg-blue-500/10 p-1.5">
                <CalendarCheck className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground">Presenca</span>
            </div>
            <p className="text-xl font-bold text-blue-500">{attendancePct}%</p>
            <p className="text-xs text-muted-foreground">{attendanceStats.present}/{attendanceStats.total} jogos</p>
          </CardContent>
        </Card>
      </div>

      {/* ── PIX Payment Section (if has pending fees) ── */}
      {pendingFees.length > 0 && (group?.pix_key || group?.pix_brcode) && (
        <Card className="mb-6 border-2 border-[#00C853]/30 bg-gradient-to-r from-[#00C853]/5 to-transparent">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-[#1B1F4B] mb-1">Pague via PIX</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Escaneie o QR Code para pagar suas pendencias. Depois, envie o comprovante.
                </p>
                <div className="text-sm space-y-1">
                  {group.pix_key && (
                    <p className="text-muted-foreground">
                      Chave 1: <span className="font-medium text-foreground">{group.pix_key}</span>
                    </p>
                  )}
                  {group.pix_key_2 && (
                    <p className="text-muted-foreground">
                      Chave 2: <span className="font-medium text-foreground">{group.pix_key_2}</span>
                    </p>
                  )}
                  {group.pix_key_3 && (
                    <p className="text-muted-foreground">
                      Chave 3: <span className="font-medium text-foreground">{group.pix_key_3}</span>
                    </p>
                  )}
                  {group.pix_beneficiary_name && (
                    <p className="text-muted-foreground">
                      Favorecido: <span className="font-medium text-foreground">{group.pix_beneficiary_name}</span>
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Total pendente: <span className="font-bold text-red-500">R$ {totalPending.toFixed(2)}</span>
                  </p>
                </div>
              </div>
              {group.pix_key && (
                <PixQrCode
                  pixKey={group.pix_key}
                  pixKeyType={group.pix_key_type || undefined}
                  beneficiaryName={group.pix_beneficiary_name || group.name}
                  amount={totalPending}
                  description={`Mensalidade ${group.name}`}
                  size={160}
                  manualBrCode={group.pix_brcode}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Proximos Jogos (RSVP) ── */}
      {upcomingMatches.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="p-4 border-b flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#1B1F4B]" />
              <h3 className="font-bold text-[#1B1F4B]">Proximos Jogos</h3>
            </div>
            <div className="divide-y">
              {upcomingMatches.map(match => {
                const confs = match.confirmations || []
                const confirmedCount = confs.filter((c: any) => c.status === 'confirmed').length
                const declinedCount = confs.filter((c: any) => c.status === 'declined').length
                const myStatus = myConfirmations[match.id]
                const confirmedNames = confs
                  .filter((c: any) => c.status === 'confirmed')
                  .map((c: any) => c.member?.name || '?')

                return (
                  <div key={match.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-[#1B1F4B] capitalize">
                          {format(new Date(match.match_date + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR })}
                        </p>
                        {match.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{match.location}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          <UserCheck className="h-3 w-3 inline text-[#00C853]" /> {confirmedCount}
                          {' '}&bull;{' '}
                          <UserX className="h-3 w-3 inline text-red-400" /> {declinedCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={myStatus === 'confirmed' ? 'default' : 'outline'}
                        className={`h-8 gap-1.5 ${
                          myStatus === 'confirmed'
                            ? 'bg-[#00C853] hover:bg-[#00A843] text-white'
                            : 'text-[#00C853] border-[#00C853]/50 hover:bg-[#00C853]/10'
                        }`}
                        onClick={() => toggleMatchConfirmation(match.id, 'confirmed')}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Vou
                      </Button>
                      <Button
                        size="sm"
                        variant={myStatus === 'declined' ? 'default' : 'outline'}
                        className={`h-8 gap-1.5 ${
                          myStatus === 'declined'
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'text-red-400 border-red-300/50 hover:bg-red-50'
                        }`}
                        onClick={() => toggleMatchConfirmation(match.id, 'declined')}
                      >
                        <UserX className="h-3.5 w-3.5" />
                        Fora
                      </Button>
                    </div>

                    {confirmedNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {confirmedNames.map((name: string, i: number) => (
                          <span key={i} className="text-[10px] bg-[#00C853]/10 text-[#00C853] rounded-full px-2 py-0.5 font-medium">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Fees Table ── */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-[#1B1F4B]">Minhas Mensalidades</h3>
            <span className="text-sm text-muted-foreground">{fees.length} registros</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Pgto</TableHead>
                <TableHead className="text-right">Acao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma mensalidade registrada.
                  </TableCell>
                </TableRow>
              ) : (
                displayedFees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">
                      {format(new Date(fee.reference_month + '-15T12:00:00'), 'MMM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>R$ {Number(fee.amount).toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(fee.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{statusBadge(fee.status)}</TableCell>
                    <TableCell>
                      {fee.paid_at ? format(new Date(fee.paid_at), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {fee.receipt_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-500"
                            onClick={() => setViewingReceipt(fee.receipt_url!)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                        )}
                        {(fee.status === 'pending' || fee.status === 'overdue') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[#00C853] border-[#00C853]"
                            onClick={() => openUploadDialog(fee.id, fee.reference_month, Number(fee.amount))}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Comprovante
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {fees.length > 6 && (
            <div className="p-3 border-t text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-[#1B1F4B]"
                onClick={() => setShowAllFees(!showAllFees)}
              >
                {showAllFees ? (
                  <><ChevronUp className="h-4 w-4 mr-1" />Ver menos</>
                ) : (
                  <><ChevronDown className="h-4 w-4 mr-1" />Ver todos ({fees.length})</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Upload Receipt Dialog ── */}
      <Dialog open={uploadDialogOpen} onOpenChange={(v) => { setUploadDialogOpen(v); if (!v) { setReceiptFile(null); setUploadingFeeId(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Comprovante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Referente a: <span className="font-semibold text-foreground">
                {uploadingFeeMonth && format(new Date(uploadingFeeMonth + '-15T12:00:00'), 'MMMM/yyyy', { locale: ptBR })}
              </span>
            </p>

            {/* PIX QR Code inline */}
            {group?.pix_key && pixAmount > 0 && (
              <div className="flex justify-center py-2">
                <PixQrCode
                  pixKey={group.pix_key}
                  pixKeyType={group.pix_key_type || undefined}
                  beneficiaryName={group.pix_beneficiary_name || group.name}
                  amount={pixAmount}
                  description={`Mensalidade ${uploadingFeeMonth}`}
                  size={150}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Comprovante de pagamento *</Label>
              <Input
                ref={receiptInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              {receiptFile && (
                <p className="text-xs text-muted-foreground">
                  <Image className="h-3 w-3 inline mr-1" />
                  {receiptFile.name}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#00C853] hover:bg-[#00A843] text-white"
                onClick={submitReceipt}
                disabled={!receiptFile || uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Enviando...' : 'Enviar Comprovante'}
              </Button>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Viewer Dialog ── */}
      <Dialog open={!!viewingReceipt} onOpenChange={(v) => { if (!v) setViewingReceipt(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comprovante</DialogTitle>
          </DialogHeader>
          {viewingReceipt && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewingReceipt} alt="Comprovante" className="max-w-full max-h-[500px] rounded-lg object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
