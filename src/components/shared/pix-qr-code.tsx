'use client'

import { useState } from 'react'
import { QrCode, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PixQrCodeProps {
  pixKey: string
  pixKeyType: string
  beneficiaryName: string
  amount?: number
  description?: string
  city?: string
}

function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021
      else crc <<= 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

function buildPixPayload({
  pixKey,
  beneficiaryName,
  amount,
  description,
  city,
}: Omit<PixQrCodeProps, 'pixKeyType'>): string {
  const gui = tlv('00', 'br.gov.bcb.pix')
  const key = tlv('01', pixKey)
  const merchantAccountInfo = tlv('26', gui + key)

  const payloadFormatIndicator = tlv('00', '01')
  const mcc = tlv('52', '0000')
  const currency = tlv('53', '986')
  const amountField = amount != null ? tlv('54', amount.toFixed(2)) : ''
  const country = tlv('58', 'BR')
  const merchantName = tlv('59', beneficiaryName.slice(0, 25))
  const merchantCity = tlv('60', (city || 'SAO PAULO').slice(0, 15))

  const additionalDataContent = tlv('05', description || '***')
  const additionalData = tlv('62', additionalDataContent)

  const payloadWithoutCrc =
    payloadFormatIndicator +
    merchantAccountInfo +
    mcc +
    currency +
    amountField +
    country +
    merchantName +
    merchantCity +
    additionalData +
    '6304'

  const crcValue = crc16(payloadWithoutCrc)
  return payloadWithoutCrc + crcValue
}

export function PixQrCode({
  pixKey,
  pixKeyType,
  beneficiaryName,
  amount,
  description,
  city,
}: PixQrCodeProps) {
  const [copied, setCopied] = useState(false)

  const payload = buildPixPayload({
    pixKey,
    beneficiaryName,
    amount,
    description,
    city,
  })

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`

  function handleCopy() {
    navigator.clipboard.writeText(payload)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="card-modern-elevated p-6 flex flex-col items-center gap-4 max-w-sm mx-auto">
      <div className="flex items-center gap-2 text-foreground">
        <QrCode className="h-5 w-5 text-[#00C853]" />
        <h3 className="font-heading text-lg font-semibold">Pague via PIX</h3>
      </div>

      <div className="rounded-xl border border-border bg-white p-3">
        <img
          src={qrUrl}
          alt="QR Code PIX"
          width={250}
          height={250}
          className="rounded-lg"
        />
      </div>

      {amount != null && (
        <p className="text-2xl font-heading font-bold tabular-nums text-foreground">
          R$ {amount.toFixed(2).replace('.', ',')}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {beneficiaryName}
      </p>

      <Button
        onClick={handleCopy}
        className="btn-modern-green w-full gap-2 text-sm"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Codigo copiado!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copiar codigo PIX
          </>
        )}
      </Button>
    </div>
  )
}
