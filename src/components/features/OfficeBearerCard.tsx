import Image from 'next/image'

import { cn } from '@/lib/utils'

export interface OfficeBearerCardProps {
  name: string
  role: string
  photoUrl?: string
  variant: 'executive' | 'board'
}

export function OfficeBearerCard({ name, role, photoUrl, variant }: OfficeBearerCardProps) {
  const isExecutive = variant === 'executive'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl bg-cream-50 shadow-sm',
        'transition-[transform,box-shadow] duration-300',
        'can-hover:hover:-translate-y-1 can-hover:hover:shadow-lg',
      )}
    >
      {/* Photo */}
      <div
        className={cn(
          'relative w-full overflow-hidden bg-sand',
          isExecutive ? 'aspect-[5/6]' : 'aspect-square',
        )}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${name}, ${role}`}
            fill
            className="object-cover"
            sizes={
              isExecutive
                ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                : '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={cn('text-wood-800/20', isExecutive ? 'h-16 w-16' : 'h-12 w-12')}
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className={cn('p-5 text-center', isExecutive && 'p-6')}>
        <h3
          className={cn(
            'font-heading font-semibold text-wood-900',
            isExecutive ? 'text-xl' : 'text-lg',
          )}
        >
          {name}
        </h3>
        <p
          className={cn(
            'mt-1 font-body text-wood-800/60',
            isExecutive ? 'text-base' : 'text-sm',
          )}
        >
          {role}
        </p>
      </div>
    </div>
  )
}
