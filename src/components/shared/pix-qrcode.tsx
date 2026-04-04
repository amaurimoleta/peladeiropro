'use client'

import { QRCodeSVG } from 'qrcode.react'
import { generatePixBrCode, type PixPayload } from '@/lib/pix'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface PixQrCodeProps {
  pixKey: string
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'
  beneficiaryName: string
  amount?: number
  description?: string
  city?: string
  size?: number
  showCopyPaste?: boolean
  /** Raw BR Code (PIX Copia e Cola) pasted by user — takes priority over generated */
  manualBrCode?: string | null
}

export function PixQrCode({
  pixKey,
  pixKeyType,
  beneficiaryName,
  amount,
  description,
  city,
  size = 200,
  showCopyPaste = true,
  manualBrCode,
}: PixQrCodeProps) {
  const [copied, setCopied] = useState(false)

  // Use manual BR Code if provided, otherwise generate from key
  const brCode = manualBrCode && manualBrCode.trim().length > 20
    ? manualBrCode.trim()
    : generatePixBrCode({
        pixKey,
        pixKeyType,
        beneficiaryName,
        amount,
        description,
        city,
      })

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(brCode)
      setCopied(true)
      toast.success('PIX Copia e Cola copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-xl shadow-sm border">
        <QRCodeSVG
          value={brCode}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#FFFFFF"
          fgColor="#1B1F4B"
        />
      </div>

      {amount && amount > 0 && (
        <p className="text-sm font-semibold text-[#00C853]">
          R$ {amount.toFixed(2)}
        </p>
      )}

      {showCopyPaste && (
        <Button
          variant="outline"
          size="sm"
          onClick={copyToClipboard}
          className="gap-2 text-xs"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#00C853]" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              PIX Copia e Cola
            </>
          )}
        </Button>
      )}

      <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">
        Escaneie o QR Code ou copie o código PIX para pagar
      </p>
    </div>
  )
}
