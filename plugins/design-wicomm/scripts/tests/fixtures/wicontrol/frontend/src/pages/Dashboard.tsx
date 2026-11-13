import { Plus, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Dashboard() {
  return (
    <main className="grid grid-cols-[1fr_2fr] w-[min(90vw,400px)]">
      <div className="shadow-[0_10px_30px_rgba(15,23,42,0.06)] rounded-lg rounded-t-2xl" />
      <div className="min-w-[100px]" />
      <div className="min-w-[100px]" />
      <div className="min-w-[100px] text-zinc-700 bg-emerald-500/10 bg-primary/10 bg-rose-500/12" />
      <Button size="sm" className="md:h-10" />
      <Button />
      <Plus className="h-5 w-5" />
      <X size={16} />
      <Check />
      <span className="animate-spin motion-reduce:animate-none" />
      <span className="transition-colors" />
      <span className="transition-opacity" />
      <span className="data-[state=open]:animate-in motion-reduce:animate-none" />
    </main>
  )
}
