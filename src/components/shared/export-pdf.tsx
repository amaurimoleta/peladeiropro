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
  month?: string
  fees?: Array<{ memberName: string; amount: number; status: string; paidAt: string | null }>
  guests?: Array<{ name: string; matchDate: string; amount: number; paid: boolean }>
  expenses?: Array<{ description: string; category: string; amount: number; date: string }>
  totalIncome?: number
  totalExpenses?: number
  balance?: number
  priorBalance?: number
  saldoFinal?: number
  year?: number
  monthlyData?: Array<{ month: string; income: number; expenses: number; balance: number; saldoInicial: number; saldoFinal: number }>
  annualSaldoInicial?: number
  annualSaldoFinal?: number
  annualFeeRevenue?: number
  annualGuestRevenue?: number
  annualExpenseByCategory?: Record<string, number>
  memberCompliance?: Array<{ name: string; paidMonths: number; totalMonths: number; percentage: number }>
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

const FONT = 'Montserrat'

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

// ── Font loading ──
async function loadFontAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  } catch {
    return null
  }
}

interface FontData { regular: string; bold: string; italic: string }

async function loadFonts(): Promise<FontData | null> {
  const [regular, bold, italic] = await Promise.all([
    loadFontAsBase64('/fonts/Montserrat-Regular.ttf'),
    loadFontAsBase64('/fonts/Montserrat-Bold.ttf'),
    loadFontAsBase64('/fonts/Montserrat-Italic.ttf'),
  ])
  if (!regular || !bold || !italic) return null
  return { regular, bold, italic }
}

function registerFonts(doc: jsPDF, fonts: FontData) {
  doc.addFileToVFS('Montserrat-Regular.ttf', fonts.regular)
  doc.addFileToVFS('Montserrat-Bold.ttf', fonts.bold)
  doc.addFileToVFS('Montserrat-Italic.ttf', fonts.italic)
  doc.addFont('Montserrat-Regular.ttf', FONT, 'normal')
  doc.addFont('Montserrat-Bold.ttf', FONT, 'bold')
  doc.addFont('Montserrat-Italic.ttf', FONT, 'italic')
  doc.setFont(FONT, 'normal')
}

// ── Logo loading ──
const LOGO_WIDTH = 65   // 50 * 1.3 = 65 (30% bigger)
const LOGO_HEIGHT = 65 / (600 / 110) // ~11.9mm

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

// ── Header: title left, logo right ──
function addHeader(
  doc: jsPDF,
  logoBase64: string | null,
  fontLoaded: boolean,
  title: string,
  subtitle: string,
  headerHeight: number = 38,
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const f = fontLoaded ? FONT : 'helvetica'

  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, 0, pageWidth, headerHeight, 'F')

  // Left side: title (bold) + subtitle (italic, smaller)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont(f, 'bold')
  doc.text(title, 14, 14)

  doc.setFontSize(11)
  doc.setFont(f, 'italic')
  doc.text(subtitle, 14, 22)

  // Right side: logo aligned right
  if (logoBase64) {
    const logoX = pageWidth - 14 - LOGO_WIDTH
    const logoY = (headerHeight - LOGO_HEIGHT) / 2
    try {
      doc.addImage(logoBase64, 'PNG', logoX, logoY, LOGO_WIDTH, LOGO_HEIGHT)
    } catch {
      // silent fallback
    }
  }
}

// ── Footer ──
function addFooter(doc: jsPDF, fontLoaded: boolean) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const f = fontLoaded ? FONT : 'helvetica'
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont(f, 'normal')
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, pageHeight - 8)
  doc.text('PeladeiroPro\u00AE', pageWidth - 14, pageHeight - 8, { align: 'right' })
}

function checkPageBreak(doc: jsPDF, y: number, fontLoaded: boolean, needed: number = 40): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 30) {
    addFooter(doc, fontLoaded)
    doc.addPage()
    return 15
  }
  return y
}

// ── autoTable font helper ──
function tableFont(fontLoaded: boolean) {
  return fontLoaded ? FONT : 'helvetica'
}

// ══════════════════════════════════════════════
// Monthly PDF
// ══════════════════════════════════════════════
function generateMonthlyPdf(props: ExportPdfProps, logoBase64: string | null, fonts: FontData | null) {
  const {
    groupName, month = '', fees = [], guests = [], expenses = [],
    totalIncome = 0, totalExpenses = 0, priorBalance = 0, saldoFinal = 0,
  } = props

  const doc = new jsPDF()
  const fontLoaded = !!fonts
  if (fonts) registerFonts(doc, fonts)
  const pageWidth = doc.internal.pageSize.getWidth()
  const f = tableFont(fontLoaded)

  addHeader(doc, logoBase64, fontLoaded, `Prestacao de Contas - ${formatMonthLabel(month)}`, groupName)
  let y = 46

  // Balance Summary
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(14)
  doc.setFont(f, 'bold')
  doc.text('Resumo Financeiro', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont(f, 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Saldo Inicial:', 14, y)
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFont(f, 'bold')
  doc.text(formatCurrency(priorBalance), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setFont(f, 'normal')
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
  doc.setFont(f, 'bold')
  doc.text(formatCurrency(saldoFinal), pageWidth - 14, y, { align: 'right' })
  y += 12

  // Receitas
  const totalFeesPaid = fees.filter(x => x.status === 'paid').reduce((s, x) => s + x.amount, 0)
  const totalGuestsPaid = guests.filter(x => x.paid).reduce((s, x) => s + x.amount, 0)

  y = checkPageBreak(doc, y, fontLoaded, 30)
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(13)
  doc.setFont(f, 'bold')
  doc.text('Receitas', 14, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont(f, 'normal')
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
  doc.setDrawColor(200, 200, 200)
  doc.line(14, y, pageWidth - 14, y)
  y += 4
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFont(f, 'bold')
  doc.text('Total Receitas:', 18, y)
  doc.setTextColor(...hexToRgb(GREEN))
  doc.text(formatCurrency(totalIncome), pageWidth - 14, y, { align: 'right' })
  y += 10

  // Despesas Table
  if (expenses.length > 0) {
    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text('Despesas', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Descricao', 'Categoria', 'Valor', 'Data']],
      body: expenses.map(e => [e.description, CATEGORY_LABELS[e.category] || e.category, formatCurrency(e.amount), formatDate(e.date)]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, font: f },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40], font: f },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  // Mensalidades categorized
  if (fees.length > 0) {
    const sortByName = (a: any, b: any) => a.memberName.localeCompare(b.memberName)
    const paidFees = fees.filter(x => x.status === 'paid').sort(sortByName)
    const pendingFees = fees.filter(x => x.status === 'pending' || x.status === 'overdue').sort(sortByName)
    const dmFees = fees.filter(x => x.status === 'dm_leave').sort(sortByName)
    const waivedFees = fees.filter(x => x.status === 'waived').sort(sortByName)

    const allSorted = [
      ...paidFees.map(x => ({ ...x, displayStatus: 'Pago', displayAmount: formatCurrency(x.amount) })),
      ...pendingFees.map(x => ({ ...x, displayStatus: FEE_STATUS_LABELS[x.status] || x.status, displayAmount: 'R$ 0,00' })),
      ...dmFees.map(x => ({ ...x, displayStatus: 'Afastado DM', displayAmount: 'R$ 0,00' })),
      ...waivedFees.map(x => ({ ...x, displayStatus: 'Dispensado', displayAmount: 'R$ 0,00' })),
    ]

    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text(`Mensalidades (${paidFees.length}/${fees.length} pagos)`, 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Membro', 'Valor', 'Status', 'Data Pagamento']],
      body: allSorted.map(x => [x.memberName, x.displayAmount, x.displayStatus, x.status === 'paid' ? formatDate(x.paidAt) : '-']),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, font: f },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40], font: f },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const status = data.cell.raw as string
          if (status === 'Pago') data.cell.styles.textColor = hexToRgb(GREEN)
          else if (status === 'Pendente' || status === 'Atrasado') data.cell.styles.textColor = hexToRgb(AMBER)
          else if (status === 'Afastado DM') data.cell.styles.textColor = hexToRgb(BLUE)
          else data.cell.styles.textColor = hexToRgb(GRAY)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  // Guests Table
  if (guests.length > 0) {
    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text('Jogadores Avulsos', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Nome', 'Data', 'Valor', 'Status']],
      body: guests.map(g => [g.name, formatDate(g.matchDate), formatCurrency(g.amount), g.paid ? 'Pago' : 'Pendente']),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, font: f },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40], font: f },
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
  }

  addFooter(doc, fontLoaded)
  doc.save(`prestacao-contas-${groupName.toLowerCase().replace(/\s+/g, '-')}-${month}.pdf`)
}

// ══════════════════════════════════════════════
// Annual PDF
// ══════════════════════════════════════════════
function generateAnnualPdf(props: ExportPdfProps, logoBase64: string | null, fonts: FontData | null) {
  const {
    groupName, year = new Date().getFullYear(), monthlyData = [],
    totalIncome = 0, totalExpenses = 0,
    annualSaldoInicial = 0, annualSaldoFinal = 0,
    annualFeeRevenue = 0, annualGuestRevenue = 0,
    annualExpenseByCategory = {}, memberCompliance = [],
  } = props

  const doc = new jsPDF()
  const fontLoaded = !!fonts
  if (fonts) registerFonts(doc, fonts)
  const pageWidth = doc.internal.pageSize.getWidth()
  const f = tableFont(fontLoaded)

  addHeader(doc, logoBase64, fontLoaded, `Prestacao de Contas Anual ${year}`, groupName)
  let y = 46

  // Summary
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(14)
  doc.setFont(f, 'bold')
  doc.text('Resumo Anual', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont(f, 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Saldo Inicial:', 14, y)
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFont(f, 'bold')
  doc.text(formatCurrency(annualSaldoInicial), pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setFont(f, 'normal')
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
  doc.setFont(f, 'bold')
  doc.text(formatCurrency(annualSaldoFinal), pageWidth - 14, y, { align: 'right' })
  y += 12

  // Resumo por Mes
  if (monthlyData.length > 0) {
    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text('Resumo por Mes', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Mes', 'Saldo Ini.', 'Receitas', 'Despesas', 'Saldo Final']],
      body: monthlyData.map(m => [formatMonthLabel(m.month), formatCurrency(m.saldoInicial), formatCurrency(m.income), formatCurrency(m.expenses), formatCurrency(m.saldoFinal)]),
      foot: [['TOTAL', formatCurrency(annualSaldoInicial), formatCurrency(totalIncome), formatCurrency(totalExpenses), formatCurrency(annualSaldoFinal)]],
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, font: f },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40], font: f },
      footStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, font: f },
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
    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text('Receitas Detalhadas', 14, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont(f, 'normal')
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
    doc.setFont(f, 'bold')
    doc.text('Total Receitas:', 18, y)
    doc.setTextColor(...hexToRgb(GREEN))
    doc.text(formatCurrency(totalIncome), pageWidth - 14, y, { align: 'right' })
    y += 10
  }

  // Despesas Detalhadas
  const expenseEntries = Object.entries(annualExpenseByCategory).sort((a, b) => b[1] - a[1])
  if (expenseEntries.length > 0) {
    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text('Despesas Detalhadas', 14, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont(f, 'normal')
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
    doc.setFont(f, 'bold')
    doc.text('Total Despesas:', 18, y)
    doc.setTextColor(...hexToRgb(RED))
    doc.text(formatCurrency(totalExpenses), pageWidth - 14, y, { align: 'right' })
    y += 10
  }

  // Adimplencia dos Membros
  if (memberCompliance.length > 0) {
    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text('Adimplencia dos Membros', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Membro', 'Meses Pagos', '% Adimplencia']],
      body: memberCompliance.map(m => [m.name, `${m.paidMonths}/${m.totalMonths}`, `${m.percentage}%`]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, font: f },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40], font: f },
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

  addFooter(doc, fontLoaded)
  doc.save(`prestacao-contas-anual-${groupName.toLowerCase().replace(/\s+/g, '-')}-${year}.pdf`)
}

// ══════════════════════════════════════════════
// Inadimplentes PDF
// ══════════════════════════════════════════════
function generateInadimpletesPdf(props: ExportPdfProps, logoBase64: string | null, fonts: FontData | null) {
  const {
    groupName, overdueMembers = [], unpaidGuests = [],
    totalOverdueAmount = 0, totalUnpaidGuestsAmount = 0,
  } = props

  const doc = new jsPDF()
  const fontLoaded = !!fonts
  if (fonts) registerFonts(doc, fonts)
  const pageWidth = doc.internal.pageSize.getWidth()
  const f = tableFont(fontLoaded)

  addHeader(doc, logoBase64, fontLoaded, 'Relatorio de Inadimplentes', groupName)
  let y = 46

  // Summary
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFontSize(14)
  doc.setFont(f, 'bold')
  doc.text('Resumo', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont(f, 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Mensalistas em atraso:', 14, y)
  doc.setTextColor(...hexToRgb(RED))
  doc.setFont(f, 'bold')
  doc.text(`${overdueMembers.length} membros - ${formatCurrency(totalOverdueAmount)}`, pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setFont(f, 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Avulsos nao pagos:', 14, y)
  doc.setTextColor(...hexToRgb(AMBER))
  doc.setFont(f, 'bold')
  doc.text(`${unpaidGuests.length} jogadores - ${formatCurrency(totalUnpaidGuestsAmount)}`, pageWidth - 14, y, { align: 'right' })
  y += 7

  doc.setFont(f, 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Total pendente:', 14, y)
  doc.setTextColor(...hexToRgb(RED))
  doc.setFont(f, 'bold')
  doc.text(formatCurrency(totalOverdueAmount + totalUnpaidGuestsAmount), pageWidth - 14, y, { align: 'right' })
  y += 14

  // Mensalistas em atraso table
  if (overdueMembers.length > 0) {
    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text('Mensalistas em Atraso', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Membro', 'Meses em Atraso', 'Qtd', 'Valor Total']],
      body: overdueMembers.map(m => [m.name, m.months.map(mo => formatMonthLabel(mo)).join(', '), String(m.months.length), formatCurrency(m.totalAmount)]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, font: f },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40], font: f },
      alternateRowStyles: { fillColor: hexToRgb(LIGHT_GRAY) },
      margin: { left: 14, right: 14 },
      columnStyles: { 1: { cellWidth: 70 }, 2: { halign: 'center', cellWidth: 18 }, 3: { halign: 'right', cellWidth: 30 } },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          data.cell.styles.textColor = hexToRgb(RED)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 4
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, pageWidth - 14, y)
    y += 5
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(10)
    doc.setFont(f, 'bold')
    doc.text('Total em Atraso:', 14, y)
    doc.setTextColor(...hexToRgb(RED))
    doc.text(formatCurrency(totalOverdueAmount), pageWidth - 14, y, { align: 'right' })
    y += 12
  }

  // Avulsos nao pagos table
  if (unpaidGuests.length > 0) {
    y = checkPageBreak(doc, y, fontLoaded, 30)
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(13)
    doc.setFont(f, 'bold')
    doc.text('Avulsos Nao Pagos', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Nome', 'Data', 'Valor']],
      body: unpaidGuests.map(g => [g.name, formatDate(g.matchDate), formatCurrency(g.amount)]),
      headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, font: f },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40], font: f },
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
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, pageWidth - 14, y)
    y += 5
    doc.setTextColor(...hexToRgb(NAVY))
    doc.setFontSize(10)
    doc.setFont(f, 'bold')
    doc.text('Total Pendente:', 14, y)
    doc.setTextColor(...hexToRgb(AMBER))
    doc.text(formatCurrency(totalUnpaidGuestsAmount), pageWidth - 14, y, { align: 'right' })
  }

  addFooter(doc, fontLoaded)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  doc.save(`inadimplentes-${groupName.toLowerCase().replace(/\s+/g, '-')}-${todayStr}.pdf`)
}

// ══════════════════════════════════════════════
// Export Component
// ══════════════════════════════════════════════
export function ExportPdf(props: ExportPdfProps) {
  async function handleExport() {
    const [logoBase64, fonts] = await Promise.all([
      loadLogoBase64(),
      loadFonts(),
    ])

    if (props.type === 'monthly') {
      generateMonthlyPdf(props, logoBase64, fonts)
    } else if (props.type === 'annual') {
      generateAnnualPdf(props, logoBase64, fonts)
    } else {
      generateInadimpletesPdf(props, logoBase64, fonts)
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
