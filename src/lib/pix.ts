/**
 * PIX BR Code Generator (EMV QR Code Standard)
 * Generates the "PIX Copia e Cola" string for QR Code rendering
 */

function pad(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
    }
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export interface PixPayload {
  pixKey: string
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'
  beneficiaryName: string
  city?: string
  amount?: number
  description?: string
}

export function generatePixBrCode(payload: PixPayload): string {
  const {
    pixKey,
    beneficiaryName,
    city = 'SAO PAULO',
    amount,
    description,
  } = payload

  // Normalize beneficiary name (max 25 chars, no accents)
  const normalizedName = beneficiaryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25)

  const normalizedCity = city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15)

  let brCode = ''

  // ID 00: Payload Format Indicator
  brCode += pad('00', '01')

  // ID 01: Point of Initiation Method (11 = static, 12 = dynamic)
  brCode += pad('01', amount ? '12' : '11')

  // ID 26: Merchant Account Information (PIX)
  let merchantInfo = ''
  merchantInfo += pad('00', 'br.gov.bcb.pix')
  merchantInfo += pad('01', pixKey)
  if (description) {
    merchantInfo += pad('02', description.slice(0, 25))
  }
  brCode += pad('26', merchantInfo)

  // ID 52: Merchant Category Code
  brCode += pad('52', '0000')

  // ID 53: Transaction Currency (986 = BRL)
  brCode += pad('53', '986')

  // ID 54: Transaction Amount (optional)
  if (amount && amount > 0) {
    brCode += pad('54', amount.toFixed(2))
  }

  // ID 58: Country Code
  brCode += pad('58', 'BR')

  // ID 59: Merchant Name
  brCode += pad('59', normalizedName)

  // ID 60: Merchant City
  brCode += pad('60', normalizedCity)

  // ID 62: Additional Data Field
  const additionalData = pad('05', '***')
  brCode += pad('62', additionalData)

  // ID 63: CRC16 (calculated over entire payload including "6304")
  brCode += '6304'
  const checksum = crc16(brCode)
  brCode += checksum

  return brCode
}
