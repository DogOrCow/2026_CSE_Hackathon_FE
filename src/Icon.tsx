import type { ReactNode } from 'react'

const shapes = {
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8m-10 4h6" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>,
  book: <path d="M12 6c-2.4-1.8-5.6-2-9-1v13c3.4-1 6.6-.8 9 1 2.4-1.8 5.6-2 9-1V5c-3.4-1-6.6-.8-9 1Zm0 0v13" />,
  brand: <><path d="M19 13.5a3 3 0 0 1-3 3h-4l-4.5 3v-3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3Z" /><path d="M8 10h7m-7 3h4" /></>,
  check: <path d="m5 12 4 4 10-10" />,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  database: <><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" /></>,
  heart: <path d="M20.8 9a4.5 4.5 0 0 0-8-2.7L12 7.4l-.9-1.1a4.5 4.5 0 0 0-7.9 2.8c0 4.5 8.8 9.5 8.8 9.5s8.8-5 8.8-9.6Z" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  message: <path d="M20.5 13.6a3 3 0 0 1-3 3h-6L6 20v-3.4H5.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  professor: <><rect x="9" y="4" width="12" height="10" rx="1.5" /><path d="M14 18h5m-2-4v4M3 19v-2a3 3 0 0 1 6 0v2" /><circle cx="6" cy="10" r="2" /></>,
  send: <><path d="m21 3-7 18-4-7-7-4 18-7Zm0 0L10 14" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  student: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" /></>,
  undo: <path d="M8 5 3 10l5 5m-5-5h11a5 5 0 0 1 0 10h-3" />,
} satisfies Record<string, ReactNode>

interface IconProps {
  name: keyof typeof shapes
  size?: number
}

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  )
}
