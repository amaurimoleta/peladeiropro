'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

export interface MonthlyFinancialData {
  month: string
  label: string
  income: number
  expenses: number
}

export interface ExpenseCategoryData {
  name: string
  value: number
  color: string
}

interface FinancialChartsProps {
  monthlyData: MonthlyFinancialData[]
  expenseBreakdown: ExpenseCategoryData[]
}

const COLORS = ['#10b981', '#ef4444', '#6366f1', '#f59e0b', '#8b5cf6', '#ec4899']

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-white p-3 shadow-md text-sm">
      <p className="font-semibold text-brand-navy mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: R$ {Number(entry.value).toFixed(2)}
        </p>
      ))}
    </div>
  )
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="rounded-lg border bg-white p-3 shadow-md text-sm">
      <p className="font-semibold text-brand-navy">{data.name}</p>
      <p style={{ color: data.payload.color }}>R$ {Number(data.value).toFixed(2)}</p>
    </div>
  )
}

export default function FinancialCharts({ monthlyData, expenseBreakdown }: FinancialChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 mb-8">
      {/* Bar Chart - Receitas vs Despesas */}
      <div className="card-modern-elevated p-5">
        <h2 className="font-bold text-brand-navy mb-4">Receitas vs Despesas (6 meses)</h2>
        {monthlyData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados disponíveis.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(v) => `R$${v}`}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar
                dataKey="income"
                name="Receitas"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                name="Despesas"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie Chart - Despesas por Categoria */}
      <div className="card-modern-elevated p-5">
        <h2 className="font-bold text-brand-navy mb-4">Despesas por Categoria (Mes Atual)</h2>
        {expenseBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem despesas neste mes.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={expenseBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={(props: any) =>
                  `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: '#94a3b8' }}
              >
                {expenseBreakdown.map((entry, index) => (
                  <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
