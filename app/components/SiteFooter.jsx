// Global footer — legal / info pages every payment gateway needs.
// Each link routes to /<page> (see app/(legal)/*).
const LINKS = [
  { href: '/conditions-of-use', label: 'Conditions of Use' },
  { href: '/privacy', label: 'Privacy Notice' },
  { href: '/refund-policy', label: 'Refund & Cancellation' },
  { href: '/security', label: 'Security' },
  { href: '/help', label: 'Help' },
  { href: '/contact', label: 'Contact Us' },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer">
      <div className="f-links">
        {LINKS.map((l, i) => (
          <span key={l.href}>
            <a href={l.href}>{l.label}</a>{i < LINKS.length - 1 ? ' ·' : ''}
          </span>
        ))}
      </div>
      <div className="f-copy">
        © {year} payUnexa Technologies · PCI-DSS Level 1 · Payments secured with 256-bit TLS
      </div>
    </footer>
  );
}
