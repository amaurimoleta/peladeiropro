'use client'

import { useEffect, useState, useCallback } from 'react'
import { Palette, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/hooks/use-group-role'
import { logAudit } from '@/lib/audit'
import type { CustomExpenseCategory } from '@/lib/types'

const DEFAULT_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#64748B',
]

export default function CustomCategories({ groupId }: { groupId: string }) {
  const [categories, setCategories] = useState<CustomExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [saving, setSaving] = useState(false)

  const { isAdmin } = useGroupRole(groupId)
  const supabase = createClient()

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('custom_expense_categories')
      .select('*')
      .eq('group_id', groupId)
      .order('name')

    if (error) {
      console.error('Error fetching custom categories:', error)
    } else {
      setCategories(data || [])
    }
    setLoading(false)
  }, [groupId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  function openCreateDialog() {
    setName('')
    setColor(DEFAULT_COLORS[0])
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Informe o nome da categoria.')
      return
    }

    setSaving(true)

    try {
      const { data: created, error } = await supabase
        .from('custom_expense_categories')
        .insert({
          group_id: groupId,
          name: name.trim(),
          color,
        })
        .select()
        .single()

      if (error) throw error

      await logAudit(supabase, {
        groupId,
        action: 'create',
        entityType: 'custom_expense_category',
        entityId: created?.id,
        details: { name: name.trim(), color },
      })

      toast.success('Categoria criada com sucesso!')
      setDialogOpen(false)
      setName('')
      setColor(DEFAULT_COLORS[0])
      fetchCategories()
    } catch (err) {
      console.error('Error creating custom category:', err)
      toast.error('Erro ao criar categoria.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: CustomExpenseCategory) {
    const confirmed = window.confirm(
      `Excluir a categoria "${cat.name}"? Despesas existentes com esta categoria não serão excluídas, mas perderão a referência.`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('custom_expense_categories')
      .delete()
      .eq('id', cat.id)

    if (error) {
      toast.error('Erro ao excluir categoria.')
      return
    }

    await logAudit(supabase, {
      groupId,
      action: 'delete',
      entityType: 'custom_expense_category',
      entityId: cat.id,
      details: { name: cat.name },
    })

    toast.success('Categoria excluida.')
    fetchCategories()
  }

  return (
    <div className="card-modern-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Palette className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-bold text-[#1B1F4B]">Categorias Personalizadas</h2>
        </div>

        {isAdmin && (
          <>
          <Button
            size="sm"
            className="bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm hover:opacity-90"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova Categoria
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Categoria</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-sm font-medium text-[#1B1F4B] mb-1.5 block">
                    Nome
                  </Label>
                  <Input
                    placeholder="Ex: Arbitragem"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-[#1B1F4B] mb-1.5 block">
                    Cor
                  </Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          color === c
                            ? 'border-[#1B1F4B] scale-110 shadow-sm'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Label className="text-xs text-muted-foreground">Ou escolha:</Label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-0 p-0"
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {color}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                >
                  {saving ? 'Salvando...' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Carregando categorias...
        </p>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Palette className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-sm">Nenhuma categoria personalizada</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-black/10"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-sm font-medium text-[#1B1F4B]">
                  {cat.name}
                </span>
              </div>

              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(cat)}
                  title="Excluir categoria"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
