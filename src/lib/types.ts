export interface Profile {
  id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  is_master: boolean
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
  pix_key_2: string | null
  pix_key_type_2: string | null
  pix_key_3: string | null
  pix_key_type_3: string | null
  pix_brcode: string | null
  monthly_fee_amount: number
  due_day: number
  public_slug: string | null
  cover_url: string | null
  goalkeeper_pays_fee: boolean
  initial_balance: number
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
  position: string | null
  avatar_url: string | null
  team: string | null
  team_id: string | null
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
  receipt_url: string | null
  carry_over: number
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
  receipt_url: string | null
  notes: string | null
  created_at: string
}

export interface Tournament {
  id: string
  group_id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: 'active' | 'finished' | 'cancelled'
  format: 'league' | 'playoff' | 'best_of_4'
  points_win: number
  points_draw: number
  points_loss: number
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  group_id: string
  match_date: string
  location: string | null
  notes: string | null
  team_a_name: string | null
  team_b_name: string | null
  score_a: number | null
  score_b: number | null
  tournament_id: string | null
  tournament_phase: string | null
  max_players: number | null
  created_at: string
  updated_at: string
  guest_players?: GuestPlayer[]
  attendance?: MatchAttendance[]
  tournament?: Tournament
}

export interface MatchAttendance {
  id: string
  match_id: string
  member_id: string
  present: boolean
  created_at: string
  member?: GroupMember
}

export interface Expense {
  id: string
  group_id: string
  category: string
  custom_category_id: string | null
  description: string
  amount: number
  expense_date: string
  paid_by_member_id: string | null
  notes: string | null
  created_at: string
  paid_by_member?: GroupMember
  custom_category?: CustomExpenseCategory
}

export interface AuditLog {
  id: string
  group_id: string
  user_id: string | null
  user_name: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, any> | null
  created_at: string
}

export interface Announcement {
  id: string
  group_id: string
  author_id: string | null
  title: string
  content: string
  pinned: boolean
  created_at: string
  updated_at: string
  author?: GroupMember
}

export interface GroupInvite {
  id: string
  group_id: string
  token: string
  created_by: string | null
  expires_at: string
  max_uses: number
  uses: number
  created_at: string
}

export interface CustomExpenseCategory {
  id: string
  group_id: string
  name: string
  color: string
  created_at: string
}

export interface RecurringExpense {
  id: string
  group_id: string
  category: string
  custom_category_id: string | null
  description: string
  amount: number
  day_of_month: number
  active: boolean
  last_generated_month: string | null
  created_at: string
}

export interface Team {
  id: string
  group_id: string
  name: string
  color: string
  logo_url: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  member_id: string
  created_at: string
  member?: GroupMember
}

export interface TournamentTeam {
  id: string
  tournament_id: string
  team_id: string
  created_at: string
}

export interface Revenue {
  id: string
  group_id: string
  description: string
  amount: number
  revenue_date: string
  category: string
  notes: string | null
  created_at: string
}

export const REVENUE_CATEGORIES: Record<string, string> = {
  sponsorship: 'Patrocinio',
  donation: 'Doacao',
  event: 'Evento',
  prize: 'Premiacao',
  rental: 'Aluguel',
  other: 'Outros',
}

export const EXPENSE_CATEGORIES: Record<string, string> = {
  court_rental: 'Quadra',
  goalkeeper: 'Goleiro',
  equipment: 'Equipamento',
  drinks: 'Bebidas',
  churrasco: 'Churrasco',
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
  admin: 'Presidente',
  treasurer: 'Tesoureiro',
  member: 'Membro',
}

export const MEMBER_TYPES: Record<string, string> = {
  mensalista: 'Mensalista',
  avulso: 'Avulso',
}

export const TOURNAMENT_STATUSES: Record<string, string> = {
  active: 'Em andamento',
  finished: 'Encerrado',
  cancelled: 'Cancelado',
}

export const TOURNAMENT_FORMATS: Record<string, string> = {
  league: 'Pontos Corridos',
  playoff: 'Playoff (Mata-mata)',
  best_of_4: 'Melhor de 4 Vitórias',
}

export const PLAYOFF_PHASES: Record<string, string> = {
  final: 'Final',
  semi: 'Semifinal',
  quarter: 'Quartas de Final',
  round16: 'Oitavas de Final',
  group: 'Fase de Grupos',
}

export const PLAYER_POSITIONS: Record<string, string> = {
  goleiro: 'Goleiro',
  zagueiro: 'Zagueiro',
  lateral: 'Lateral',
  meia: 'Meia',
  atacante: 'Atacante',
  pivo: 'Pivo',
  fixo: 'Fixo',
  ala: 'Ala',
}

export const FEE_STATUSES: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Atrasado',
  waived: 'Dispensado',
  dm_leave: 'Afastado (DM)',
}
