import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva('inline-flex transition-all', {
  variants: {
    size: {
      default: 'h-10 px-4',
      sm: 'h-9 px-3',
      icon: 'h-10 w-10',
    },
  },
})

export function Button({ size, className }: { size?: 'default' | 'sm' | 'icon'; className?: string }) {
  return <button className={cn(buttonVariants({ size }), className)} />
}
