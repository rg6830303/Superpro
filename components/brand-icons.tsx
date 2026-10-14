/**
 * Real brand marks for the club's socials (lucide's generic glyphs read as
 * "chat" and "camera", not WhatsApp and Instagram).
 */
type P = { size?: number; className?: string };

export function WhatsAppIcon({ size = 16, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#25D366"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z"
      />
      <path
        fill="#fff"
        d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1l-.9 1.2c-.2.2-.3.2-.6.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.8a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3Z"
      />
    </svg>
  );
}

export function InstagramIcon({ size = 16, className }: P) {
  const id = "ig-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset=".05" stopColor="#fdf497" />
          <stop offset=".45" stopColor="#fd5949" />
          <stop offset=".6" stopColor="#d6249f" />
          <stop offset=".9" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill={`url(#${id})`} />
      <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.6" cy="7.4" r="1.05" fill="#fff" />
    </svg>
  );
}
