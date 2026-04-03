'use client'

import { Button } from '@/components/ui/button'
import { Share2 } from 'lucide-react'

export function ShareButton({ groupName, slug }: { groupName: string; slug: string }) {
  function handleShare() {
    const url = `${window.location.origin}/p/${slug}`
    const text = `Confira a prestação de contas da ${groupName}`

    // Try native share first (mobile)
    if (navigator.share) {
      navigator.share({ title: `${groupName} - PeladeiroPro`, text, url })
      return
    }

    // Fallback to WhatsApp
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
    window.open(waUrl, '_blank')
  }

  return (
    <Button
      onClick={handleShare}
      className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
    >
      <Share2 className="h-4 w-4 mr-2" />
      Compartilhar via WhatsApp
    </Button>
  )
}
