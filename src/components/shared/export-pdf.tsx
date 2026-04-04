'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const FEE_STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Atrasado',
  waived: 'Dispensado',
  dm_leave: 'Afastado DM',
}

const CATEGORY_LABELS: Record<string, string> = {
  court_rental: 'Quadra',
  goalkeeper: 'Goleiro',
  equipment: 'Equipamento',
  drinks: 'Bebidas',
  churrasco: 'Churrasco',
  other: 'Outros',
}

interface ExportPdfProps {
  type: 'monthly' | 'annual' | 'inadimplentes'
  groupName: string
  // Monthly data
  month?: string
  fees?: Array<{ memberName: string; amount: number; status: string; paidAt: string | null }>
  guests?: Array<{ name: string; matchDate: string; amount: number; paid: boolean }>
  expenses?: Array<{ description: string; category: string; amount: number; date: string }>
  totalIncome?: number
  totalExpenses?: number
  balance?: number
  priorBalance?: number
  saldoFinal?: number
  // Annual data
  year?: number
  monthlyData?: Array<{ month: string; income: number; expenses: number; balance: number; saldoInicial: number; saldoFinal: number }>
  annualSaldoInicial?: number
  annualSaldoFinal?: number
  annualFeeRevenue?: number
  annualGuestRevenue?: number
  annualExpenseByCategory?: Record<string, number>
  memberCompliance?: Array<{ name: string; paidMonths: number; totalMonths: number; percentage: number }>
  // Inadimplentes data
  overdueMembers?: Array<{ name: string; months: string[]; totalAmount: number }>
  unpaidGuests?: Array<{ name: string; matchDate: string; amount: number }>
  totalOverdueAmount?: number
  totalUnpaidGuestsAmount?: number
}

const NAVY = '#1B1F4B'
const GREEN = '#00C853'
const RED = '#EF4444'
const LIGHT_GRAY = '#F3F4F6'
const AMBER = '#F59E0B'
const BLUE = '#3B82F6'
const GRAY = '#9CA3AF'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR')
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  const months = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  return `${months[parseInt(month, 10) - 1]} ${year}`
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0]
}

function addFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, pageHeight - 8)
  doc.text('PeladeiroPro\u00AE', pageWidth - 14, pageHeight - 8, { align: 'right' })
}

const LOGO_WIDTH = 50
const LOGO_HEIGHT = 50 / (600 / 110) // ~9.2mm maintaining aspect ratio

async function loadLogoBase64(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || 600
      canvas.height = img.naturalHeight || 110
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = '/logo-white.svg'
  })
}

function addHeaderLogo(doc: jsPDF, logoBase64: string | null, x: number, y: number) {
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', x, y, LOGO_WIDTH, LOGO_HEIGHT)
    } catch {
      // Fallback to text if image fails
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('PeladeiroPro', x, y + 7)
    }
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('PeladeiroPro', x, y + 7)
  }
}

function checkPageBreak(doc: jsPDF, y: number, needed: number = 40): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 30) {
    addFooter(doc)
    doc.addPage()
    return 15
  }
  return y
}

function generateMonthlyPdf(props: ExportPdfProps, logoBase64: string | null) {
  const {
    groupName,
    month = '',
    fees = [],
    guests = [],
    expenses = [],
    totalIncome = 0,
    totalExpenses = 0,
    priorBalance = 0,
    saldoFinal = 0,
  } = props

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15

  // Header
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, 0, pageWidth, 40, 'F')
  addHeaderLogo(doc, logoBase64, 14, 4)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(groupName, 14, y + 14)
  doc.setFontSize(12)
  doc.text(`Prestacao de Contas - ${formatMonthLabel(month)}`, 14, y + 22)
  y = 50

  // Balance Summary (4 values like the page)
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo Financeiro', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  doc.setTextColor(60, 60, 60)
  doc.text('Saldo Inicial:', 14, y)
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(priorBalance), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Receitas:', 14, y)
  doc.setTextColor(...hexToRgb(GREEN))
  doc.text(formatCurrency(totalIncome), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setTextColor(60, 60, 60)
  doc.text('Despesas:', 14, y)
  doc.setTextColor(...hexToRgb(RED))
  doc.text(formatCurrency(totalExpenses), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setTextColor(60, 60, 60)
  doc.text('Saldo Final:', 14, y)
  doc.setTextColor(...hexToRgb(saldoFinal >= 0 ? GREEN : RED))
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(saldoFinal), pageWidth - 14, y, { align: 'right' })
  y += 12

  // Receitas section
  const totalFeesPaid = fees.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0)
  const totalGuestsPaid = guests.filter(g => g.paid).reduce((s, g) => s + g.amount, 0)

  y = checkPageBreak(doc, y, 30)
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Receitas', 14, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (totalFeesPaid > 0) {
    doc.setTextColor(60, 60, 60)
    doc.text('Mensalidades pagas:', 18, y)
    doc.setTextColor(...hexToRgb(GREEN))
    doc.text(formatCurrency(totalFeesPaid), pageWidth - 14, y, { align: 'right' })
    y += 6
  }
  if (totalGuestsPaid > 0) {
    doc.setTextColor(60, 60, 60)
    doc.text('Jogadores avulsos:', 18, y)
    doc.setTextColor(...hexToRgb(GREEN))
    doc.text(formatCurrency(totalGuestsPaid), pageWidth - 14, y, { align: 'right' })
    y += 6
  }
  // Total
  doc.setDrawColor(200, 200, 200)
  doc.line(14, y, pageWidth - 14, y)
  y += 4
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFont('helvetica', 'bold')
  doc.text('Total Receitas:', 18, y)
  doc.setTextColor(...hexToRgb(GREEN))
  doc.text(formatCurrency(totalIncome), pageWidth - 14, y, { align: 'right' })
  y += 10

  // Despesas Table
  if (expenses.length > 0) {
    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Despesas', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Descricao', 'Categoria', 'Valor', 'Data']],
      body: expenses.map((e) => [
        e.description,
        CATEGORY_LABELS[e.category] || e.category,
        formatCurrency(e.amount),
        formatDate(e.date),
      ]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  // Mensalidades categorized
  if (fees.length > 0) {
    const sortByName = (a: any, b: any) => a.memberName.localeCompare(b.memberName)
    const paidFees = fees.filter(f => f.status === 'paid').sort(sortByName)
    const pendingFees = fees.filter(f => f.status === 'pending' || f.status === 'overdue').sort(sortByName)
    const dmFees = fees.filter(f => f.status === 'dm_leave').sort(sortByName)
    const waivedFees = fees.filter(f => f.status === 'waived').sort(sortByName)

    const allSorted = [
      ...paidFees.map(f => ({ ...f, displayStatus: 'Pago', displayAmount: formatCurrency(f.amount) })),
      ...pendingFees.map(f => ({ ...f, displayStatus: FEE_STATUS_LABELS[f.status] || f.status, displayAmount: 'R$ 0,00' })),
      ...dmFees.map(f => ({ ...f, displayStatus: 'Afastado DM', displayAmount: 'R$ 0,00' })),
      ...waivedFees.map(f => ({ ...f, displayStatus: 'Dispensado', displayAmount: 'R$ 0,00' })),
    ]

    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`Mensalidades (${paidFees.length}/${fees.length} pagos)`, 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Membro', 'Valor', 'Status', 'Data Pagamento']],
      body: allSorted.map((f) => [
        f.memberName,
        f.displayAmount,
        f.displayStatus,
        f.status === 'paid' ? formatDate(f.paidAt) : '-',
      ]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const status = data.cell.raw as string
          if (status === 'Pago') {
            data.cell.styles.textColor = hexToRgb(GREEN)
          } else if (status === 'Pendente' || status === 'Atrasado') {
            data.cell.styles.textColor = hexToRgb(AMBER)
          } else if (status === 'Afastado DM') {
            data.cell.styles.textColor = hexToRgb(BLUE)
          } else {
            data.cell.styles.textColor = hexToRgb(GRAY)
          }
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  // Guests Table
  if (guests.length > 0) {
    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Jogadores Avulsos', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Nome', 'Data', 'Valor', 'Status']],
      body: guests.map((g) => [
        g.name,
        formatDate(g.matchDate),
        formatCurrency(g.amount),
        g.paid ? 'Pago' : 'Pendente',
      ]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw as string
          data.cell.styles.textColor = val === 'Pago' ? hexToRgb(GREEN) : hexToRgb(AMBER)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  addFooter(doc)
  doc.save(`prestacao-contas-${groupName.toLowerCase().replace(/\s+/g, '-')}-${month}.pdf`)
}

function generateAnnualPdf(props: ExportPdfProps, logoBase64: string | null) {
  const {
    groupName,
    year = new Date().getFullYear(),
    monthlyData = [],
    totalIncome = 0,
    totalExpenses = 0,
    annualSaldoInicial = 0,
    annualSaldoFinal = 0,
    annualFeeRevenue = 0,
    annualGuestRevenue = 0,
    annualExpenseByCategory = {},
    memberCompliance = [],
  } = props

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15

  // Header
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, 0, pageWidth, 36, 'F')
  addHeaderLogo(doc, logoBase64, 14, 3)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(`${groupName} - Prestacao de Contas Anual ${year}`, 14, y + 16)
  y = 46

  // Summary cards equivalent
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo Anual', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Saldo Inicial:', 14, y)
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(annualSaldoInicial), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Receitas:', 14, y)
  doc.setTextColor(...hexToRgb(GREEN))
  doc.text(formatCurrency(totalIncome), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setTextColor(60, 60, 60)
  doc.text('Despesas:', 14, y)
  doc.setTextColor(...hexToRgb(RED))
  doc.text(formatCurrency(totalExpenses), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setTextColor(60, 60, 60)
  doc.text('Saldo Final:', 14, y)
  doc.setTextColor(...hexToRgb(annualSaldoFinal >= 0 ? GREEN : RED))
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(annualSaldoFinal), pageWidth - 14, y, { align: 'right' })
  y += 12

  // Resumo por Mes (with saldo inicial and saldo final)
  if (monthlyData.length > 0) {
    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumo por Mes', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Mes', 'Saldo Ini.', 'Receitas', 'Despesas', 'Saldo Final']],
      body: monthlyData.map((m) => [
        formatMonthLabel(m.month),
        formatCurrency(m.saldoInicial),
        formatCurrency(m.income),
        formatCurrency(m.expenses),
        formatCurrency(m.saldoFinal),
      ]),
      foot: [[
        'TOTAL',
        formatCurrency(annualSaldoInicial),
        formatCurrency(totalIncome),
        formatCurrency(totalExpenses),
        formatCurrency(annualSaldoFinal),
      ]],
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      footStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const raw = data.cell.raw as string
          data.cell.styles.textColor = raw.includes('-') ? hexToRgb(RED) : hexToRgb(GREEN)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 12
  }

  // Receitas Detalhadas
  if (totalIncome > 0) {
    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Receitas Detalhadas', 14, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    if (annualFeeRevenue > 0) {
      doc.setTextColor(60, 60, 60)
      doc.text('Mensalidades pagas:', 18, y)
      doc.setTextColor(...hexToRgb(GREEN))
      doc.text(formatCurrency(annualFeeRevenue), pageWidth - 14, y, { align: 'right' })
      y += 6
    }
    if (annualGuestRevenue > 0) {
      doc.setTextColor(60, 60, 60)
      doc.text('Jogadores avulsos:', 18, y)
      doc.setTextColor(...hexToRgb(GREEN))
      doc.text(formatCurrency(annualGuestRevenue), pageWidth - 14, y, { align: 'right' })
      y += 6
    }
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, pageWidth - 14, y)
    y += 4
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFont('helvetica', 'bold')
    doc.text('Total Receitas:', 18, y)
    doc.setTextColor(...hexToRgb(GREEN))
    doc.text(formatCurrency(totalIncome), pageWidth - 14, y, { align: 'right' })
    y += 10
  }

  // Despesas Detalhadas
  const expenseEntries = Object.entries(annualExpenseByCategory).sort((a, b) => b[1] - a[1])
  if (expenseEntries.length > 0) {
    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Despesas Detalhadas', 14, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const [cat, amount] of expenseEntries) {
      doc.setTextColor(60, 60, 60)
      doc.text(`${CATEGORY_LABELS[cat] || cat}:`, 18, y)
      doc.setTextColor(...hexToRgb(RED))
      doc.text(formatCurrency(amount), pageWidth - 14, y, { align: 'right' })
      y += 6
    }
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, pageWidth - 14, y)
    y += 4
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFont('helvetica', 'bold')
    doc.text('Total Despesas:', 18, y)
    doc.setTextColor(...hexToRgb(RED))
    doc.text(formatCurrency(totalExpenses), pageWidth - 14, y, { align: 'right' })
    y += 10
  }

  // Adimplencia dos Membros
  if (memberCompliance.length > 0) {
    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Adimplencia dos Membros', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Membro', 'Meses Pagos', '% Adimplencia']],
      body: memberCompliance.map((m) => [
        m.name,
        `${m.paidMonths}/${m.totalMonths}`,
        `${m.percentage}%`,
      ]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const raw = data.cell.raw as string
          const pct = parseFloat(raw)
          if (pct >= 80) data.cell.styles.textColor = hexToRgb(GREEN)
          else if (pct < 50) data.cell.styles.textColor = hexToRgb(RED)
          else data.cell.styles.textColor = hexToRgb(AMBER)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  addFooter(doc)
  doc.save(`prestacao-contas-anual-${groupName.toLowerCase().replace(/\s+/g, '-')}-${year}.pdf`)
}

function generateInadimpletesPdf(props: ExportPdfProps, logoBase64: string | null) {
  const {
    groupName,
    overdueMembers = [],
    unpaidGuests = [],
    totalOverdueAmount = 0,
    totalUnpaidGuestsAmount = 0,
  } = props

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15

  // Header
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, 0, pageWidth, 36, 'F')
  addHeaderLogo(doc, logoBase64, 14, 3)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(`${groupName} - Relatorio de Inadimplentes`, 14, y + 16)
  y = 46

  // Summary
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Mensalistas em atraso:', 14, y)
  doc.setTextColor(...hexToRgb(RED))
  doc.setFont('helvetica', 'bold')
  doc.text(`${overdueMembers.length} membros - ${formatCurrency(totalOverdueAmount)}`, pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Avulsos nao pagos:', 14, y)
  doc.setTextColor(...hexToRgb(AMBER))
  doc.setFont('helvetica', 'bold')
  doc.text(`${unpaidGuests.length} jogadores - ${formatCurrency(totalUnpaidGuestsAmount)}`, pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Total pendente:', 14, y)
  doc.setTextColor(...hexToRgb(RED))
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(totalOverdueAmount + totalUnpaidGuestsAmount), pageWidth - 14, y, { align: 'right' })
  y += 14

  // Mensalistas em atraso table
  if (overdueMembers.length > 0) {
    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Mensalistas em Atraso', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Membro', 'Meses em Atraso', 'Qtd', 'Valor Total']],
      body: overdueMembers.map((m) => [
        m.name,
        m.months.map(mo => formatMonthLabel(mo)).join(', '),
        String(m.months.length),
        formatCurrency(m.totalAmount),
      ]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      columnStyles: {
        1: { cellWidth: 70 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 30 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          data.cell.styles.textColor = hexToRgb(RED)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 4

    // Total row
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, pageWidth - 14, y)
    y += 5
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Total em Atraso:', 14, y)
    doc.setTextColor(...hexToRgb(RED))
    doc.text(formatCurrency(totalOverdueAmount), pageWidth - 14, y, { align: 'right' })
    y += 12
  }

  // Avulsos nao pagos table
  if (unpaidGuests.length > 0) {
    y = checkPageBreak(doc, y, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Avulsos Nao Pagos', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Nome', 'Data', 'Valor']],
      body: unpaidGuests.map((g) => [
        g.name,
        formatDate(g.matchDate),
        formatCurrency(g.amount),
      ]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          data.cell.styles.textColor = hexToRgb(AMBER)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 4

    // Total row
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, pageWidth - 14, y)
    y += 5
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Total Pendente:', 14, y)
    doc.setTextColor(...hexToRgb(AMBER))
    doc.text(formatCurrency(totalUnpaidGuestsAmount), pageWidth - 14, y, { align: 'right' })
  }

  addFooter(doc)
  const today = new Date().toISOString().split('T')[0]
  doc.save(`inadimplentes-${groupName.toLowerCase().replace(/\s+/g, '-')}-${today}.pdf`)
}

export function ExportPdf(props: ExportPdfProps) {
  async function handleExport() {
    const logoBase64 = await loadLogoBase64()
    if (props.type === 'monthly') {
      generateMonthlyPdf(props, logoBase64)
    } else if (props.type === 'annual') {
      generateAnnualPdf(props, logoBase64)
    } else {
      generateInadimpletesPdf(props, logoBase64)
    }
  }

  return (
    <Button
      onClick={handleExport}
      className="bg-[#00C853] hover:bg-[#00A844] text-white font-semibold"
    >
      <Download className="h-4 w-4 mr-2" />
      Exportar PDF
    </Button>
  )
}
