'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportPdfProps {
  type: 'monthly' | 'annual'
  groupName: string
  // Monthly data
  month?: string // "2026-04"
  fees?: Array<{ memberName: string; amount: number; status: string; paidAt: string | null }>
  guests?: Array<{ name: string; matchDate: string; amount: number; paid: boolean }>
  expenses?: Array<{ description: string; category: string; amount: number; date: string }>
  totalIncome?: number
  totalExpenses?: number
  balance?: number
  // Annual data
  year?: number
  monthlyData?: Array<{ month: string; income: number; expenses: number; balance: number }>
  memberCompliance?: Array<{ name: string; percentage: number }>
}

const NAVY = '#1B1F4B'
const GREEN = '#00C853'
const RED = '#EF4444'
const LIGHT_GRAY = '#F3F4F6'

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

function generateMonthlyPdf(props: ExportPdfProps) {
  const {
    groupName,
    month = '',
    fees = [],
    guests = [],
    expenses = [],
    totalIncome = 0,
    totalExpenses = 0,
    balance = 0,
  } = props

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15

  // Header
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('PeladeiroPro', 14, y + 5)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(groupName, 14, y + 14)

  doc.setFontSize(12)
  doc.text(`Relatorio Mensal - ${formatMonthLabel(month)}`, 14, y + 22)

  y = 50

  // Summary Section
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo Financeiro', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  doc.setTextColor(60, 60, 60)
  doc.text(`Receitas (mensalidades + convidados):`, 14, y)
  doc.setTextColor(...hexToRgb(GREEN))
  doc.text(formatCurrency(totalIncome), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setTextColor(60, 60, 60)
  doc.text(`Despesas:`, 14, y)
  doc.setTextColor(...hexToRgb(RED))
  doc.text(formatCurrency(totalExpenses), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setTextColor(60, 60, 60)
  doc.text(`Saldo:`, 14, y)
  const balanceColor = balance >= 0 ? GREEN : RED
  doc.setTextColor(...hexToRgb(balanceColor))
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(balance), pageWidth - 14, y, { align: 'right' })
  y += 12

  // Mensalidades Table
  if (fees.length > 0) {
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Mensalidades', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Membro', 'Valor', 'Status', 'Data Pagamento']],
      body: fees.map((f) => [
        f.memberName,
        formatCurrency(f.amount),
        f.status,
        formatDate(f.paidAt),
      ]),
      headStyles: {
        fillColor: hexToRgb(NAVY),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const status = data.cell.raw as string
          if (status === 'paid' || status === 'pago') {
            data.cell.styles.textColor = hexToRgb(GREEN)
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = hexToRgb(RED)
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })

    y = (doc as any).lastAutoTable.finalY + 10
  }

  // Guests Table
  if (guests.length > 0) {
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Convidados', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Nome', 'Data do Jogo', 'Valor', 'Pago']],
      body: guests.map((g) => [
        g.name,
        formatDate(g.matchDate),
        formatCurrency(g.amount),
        g.paid ? 'Sim' : 'Nao',
      ]),
      headStyles: {
        fillColor: hexToRgb(NAVY),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw as string
          if (val === 'Sim') {
            data.cell.styles.textColor = hexToRgb(GREEN)
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = hexToRgb(RED)
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })

    y = (doc as any).lastAutoTable.finalY + 10
  }

  // Expenses Table
  if (expenses.length > 0) {
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
        e.category,
        formatCurrency(e.amount),
        formatDate(e.date),
      ]),
      headStyles: {
        fillColor: hexToRgb(NAVY),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
    })

    y = (doc as any).lastAutoTable.finalY + 10
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    pageHeight - 8,
  )
  doc.text(
    'PeladeiroPro - Gestao de tesouraria',
    pageWidth - 14,
    pageHeight - 8,
    { align: 'right' },
  )

  doc.save(`relatorio-${groupName.toLowerCase().replace(/\s+/g, '-')}-${month}.pdf`)
}

function generateAnnualPdf(props: ExportPdfProps) {
  const {
    groupName,
    year = new Date().getFullYear(),
    monthlyData = [],
    memberCompliance = [],
  } = props

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15

  // Header
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, 0, pageWidth, 36, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('PeladeiroPro', 14, y + 5)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(`${groupName} - Relatorio Anual ${year}`, 14, y + 16)

  y = 46

  // Monthly Summary Table
  if (monthlyData.length > 0) {
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumo Mensal', 14, y)
    y += 2

    const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0)
    const totalExp = monthlyData.reduce((s, m) => s + m.expenses, 0)
    const totalBal = monthlyData.reduce((s, m) => s + m.balance, 0)

    autoTable(doc, {
      startY: y,
      head: [['Mes', 'Receitas', 'Despesas', 'Saldo']],
      body: monthlyData.map((m) => [
        formatMonthLabel(m.month),
        formatCurrency(m.income),
        formatCurrency(m.expenses),
        formatCurrency(m.balance),
      ]),
      foot: [[
        'TOTAL',
        formatCurrency(totalIncome),
        formatCurrency(totalExp),
        formatCurrency(totalBal),
      ]],
      headStyles: {
        fillColor: hexToRgb(NAVY),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      footStyles: {
        fillColor: hexToRgb(NAVY),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const raw = data.cell.raw as string
          const isNegative = raw.includes('-')
          data.cell.styles.textColor = isNegative ? hexToRgb(RED) : hexToRgb(GREEN)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    y = (doc as any).lastAutoTable.finalY + 12
  }

  // Member Compliance Table
  if (memberCompliance.length > 0) {
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Adimplencia dos Membros', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Membro', '% Meses Pagos']],
      body: memberCompliance.map((m) => [
        m.name,
        `${m.percentage.toFixed(0)}%`,
      ]),
      headStyles: {
        fillColor: hexToRgb(NAVY),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const raw = data.cell.raw as string
          const pct = parseFloat(raw)
          if (pct >= 80) {
            data.cell.styles.textColor = hexToRgb(GREEN)
          } else if (pct < 50) {
            data.cell.styles.textColor = hexToRgb(RED)
          }
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    pageHeight - 8,
  )
  doc.text(
    'PeladeiroPro - Gestao de tesouraria',
    pageWidth - 14,
    pageHeight - 8,
    { align: 'right' },
  )

  doc.save(`relatorio-anual-${groupName.toLowerCase().replace(/\s+/g, '-')}-${year}.pdf`)
}

export function ExportPdf(props: ExportPdfProps) {
  function handleExport() {
    if (props.type === 'monthly') {
      generateMonthlyPdf(props)
    } else {
      generateAnnualPdf(props)
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
