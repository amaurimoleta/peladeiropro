export interface Profile {
  id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  name: string
  description: string | null
  pix_key: string | null
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null
  pix_beneficiary_name: string | null
  monthly_fee_amount: number
  due_day: number
  public_slug: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  profile_id: string | null
  name: string
  phone: string | null
  role: 'admin' | 'treasurer' | 'member'
  status: 'active' | 'inactive'
  member_type: 'mensalista' | 'avulso'
  joined_at: string
  created_at: string
}

export interface MonthlyFee {
  id: string
  group_id: string
  member_id: string
  reference_month: string
  amount: number
  due_date: string
  paid_at: string | null
  payment_method: string | null
  status: 'pending' | 'paid' | 'overdue' | 'waived' | 'dm_leave'
  notes: string | null
  created_at: string
  member?: GroupMember
}

export interface GuestPlayer {
  id: string
  group_id: string
  name: string
  phone: string | null
  match_date: string
  match_id: string | null
  amount: number
  paid: boolean
  paid_at: string | null
  notes: string | null
  created_at: string
}

export interface Match {
  id: string
  group_id: string
  match_date: string
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
  guest_players?: GuestPlayer[]
}

export interface Expense {
  id: string
  group_id: string
  category: 'court_rental' | 'goalkeeper' | 'equipment' | 'drinks' | 'other'
  description: string
  amount: number
  expense_date: string
  paid_by_member_id: string | null
  notes: string | null
  created_at: string
  paid_by_member?: GroupMember
}

export const EXPENSE_CATEGORIES: Record<Expense['category'], string> = {
  court_rental: 'Quadra',
  goalkeeper: 'Goleiro',
  equipment: 'Equipamento',
  drinks: 'Bebidas',
  other: 'Outros',
}

export const PIX_KEY_TYPES: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Chave Aleatoria',
}

export const MEMBER_ROLES: Record<string, string> = {
  admin: 'Administrador',
  treasurer: 'Tesoureiro',
  member: 'Membro',
}

export const MEMBER_TYPES: Record<string, string> = {
  mensalista: 'Mensalista',
  avulso: 'Avulso',
}

export const FEE_STATUSES: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Atrasado',
  waived: 'Dispensado',
  dm_leave: 'Afastado (DM)',
}
