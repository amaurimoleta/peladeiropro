'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Check, Clock, AlertCircle, Zap, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { MonthNavigator } from '@/components/shared/month-navigator'
import type { MonthlyFee, GroupMember, Group } from '@/lib/types'

export default function PaymentsPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [fees, setFees] = useState<(MonthlyFee & { member?: { name: string; member_type: string } })[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const currentMonth = format(currentDate, 'yyyy-MM')

  async function loadData() {
    setLoading(true)
    const [{ data: groupData }, { data: membersData }, { data: feesData }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .eq('member_type', 'mensalista')
        .order('name'),
      supabase
        .from('monthly_fees')
        .select('*, member:group_members(name, member_type)')
        .eq('group_id', groupId)
        .eq('reference_month', currentMonth),
    ])
    setGroup(groupData)
    setMembers(membersData || [])
    setFees(feesData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [groupId, currentMonth])

  async function generateFees() {
    if (!group || members.length === 0) return
    setGenerating(true)

    const existingMemberIds = new Set(fees.map(f => f.member_id))
    const newFees = members
      .filter(m => !existingMemberIds.has(m.id))
      .map(m => ({
        group_id: groupId,
        member_id: m.id,
        reference_month: currentMonth,
        amount: group.monthly_fee_amount,
        due_date: `${currentMonth}-${String(group.due_day).padStart(2, '0')}`,
        status: 'pending' as const,
      }))

    if (newFees.length === 0) {
      toast.info('Todas as mensalidades já foram geradas para este mês.')
      setGenerating(false)
      return
    }

    const { error } = await supabase.from('monthly_fees').insert(newFees)
    if (error) {
      toast.error('Erro ao gerar mensalidades', { description: error.message })
    } else {
      toast.success(`${newFees.length} mensalidades geradas!`)
      loadData()
    }
    setGenerating(false)
  }

  async function markAsPaid(feeId: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: 'pix' })
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao marcar pagamento')
    } else {
      toast.success('Pagamento confirmado!')
      loadData()
    }
  }

  async function markAsDmLeave(feeId: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .update({ status: 'dm_leave' })
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao marcar afastamento DM')
    } else {
      toast.success('Membro marcado como afastado (DM).')
      loadData()
    }
  }

  async function markAsWaived(feeId: string) {
    const { error } = await supabase
      .from('monthly_fees')
      .update({ status: 'waived' })
      .eq('id', feeId)
    if (error) {
      toast.error('Erro ao dispensar mensalidade')
    } else {
      toast.success('Mensalidade dispensada.')
      loadData()
    }
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
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"><Stethoscope className="h-3 w-3 mr-1" />Afastado DM</Badge>
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
    }
  }

  const paidCount = fees.filter(f => f.status === 'paid').length
  const totalAmount = fees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0)
  const dmCount = fees.filter(f => f.status === 'dm_leave').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F4B]">Mensalidades</h1>
          <p className="text-muted-foreground">
            {paidCount}/{fees.length} pagas | R$ {totalAmount.toFixed(2)} recebido{dmCount > 0 ? ` | ${dmCount} afastados DM` : ''}
          </p>
        </div>
        <Button
          className="bg-[#00C853] hover:bg-[#00A843] text-white"
          onClick={generateFees}
          disabled={generating}
        >
          <Zap className="h-4 w-4 mr-2" />
          {generating ? 'Gerando...' : 'Gerar Mensalidades'}
        </Button>
      </div>

      <MonthNavigator currentDate={currentDate} onChange={setCurrentDate} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Pgto</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : fees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma mensalidade gerada. Clique em &quot;Gerar Mensalidades&quot; para criar.
                  </TableCell>
                </TableRow>
              ) : (
                fees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">{fee.member?.name}</TableCell>
                    <TableCell>R$ {Number(fee.amount).toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(fee.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{statusBadge(fee.status)}</TableCell>
                    <TableCell>
                      {fee.paid_at ? format(new Date(fee.paid_at), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {fee.status === 'pending' || fee.status === 'overdue' ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="text-[#00C853] border-[#00C853] hover:bg-[#00C853]/10" onClick={() => markAsPaid(fee.id)}>
                            <Check className="h-3 w-3 mr-1" />
                            Pago
                          </Button>
                          <Button size="sm" variant="outline" className="text-blue-600 border-blue-400 hover:bg-blue-50" onClick={() => markAsDmLeave(fee.id)}>
                            <Stethoscope className="h-3 w-3 mr-1" />
                            DM
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => markAsWaived(fee.id)}>
                            Dispensar
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
