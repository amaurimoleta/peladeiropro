'use client'

import { useRef, useState } from 'react'
import { Camera, User, Image as ImageIcon, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  currentUrl: string | null
  onUpload: (url: string) => void
  bucket: string
  folder: string
  size?: 'sm' | 'md' | 'lg'
  shape?: 'circle' | 'rounded'
  label?: string
}

const sizeMap = {
  sm: 48,
  md: 80,
  lg: 120,
} as const

export function ImageUpload({
  currentUrl,
  onUpload,
  bucket,
  folder,
  size = 'md',
  shape = 'circle',
  label,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const px = sizeMap[size]

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (error) {
        console.error('Upload error:', error)
        return
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
      onUpload(data.publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const PlaceholderIcon = shape === 'circle' ? User : ImageIcon
  const iconSize = Math.round(px * 0.4)

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'group relative overflow-hidden border border-border shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          shape === 'circle' ? 'rounded-full' : 'rounded-xl',
          'bg-muted'
        )}
        style={{ width: px, height: px }}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={label ?? 'Imagem'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlaceholderIcon
              size={iconSize}
              className="text-muted-foreground"
            />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size={Math.round(px * 0.25)} className="text-white" />
          <span
            className="text-white font-medium leading-tight"
            style={{ fontSize: Math.max(10, Math.round(px * 0.13)) }}
          >
            Alterar foto
          </span>
        </div>

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2
              size={Math.round(px * 0.35)}
              className="animate-spin text-white"
            />
          </div>
        )}
      </button>

      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
