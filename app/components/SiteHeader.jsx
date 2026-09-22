// Horizontal payUnexa header: brand logo + optional title + secure/sandbox pills.
export default function SiteHeader({ title = '', sandbox = false }) {
  return (
    <header>
      <div className="hwrap">
        <div className="logo"><span className="pay">pay</span><span className="unexa">Unexa</span></div>
        {title && <div className="chtitle">{title}</div>}
        <div className="hright">
          {sandbox && <span className="pill sandbox">SANDBOX DEMO</span>}
          <span className="pill secure">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Secure checkout
          </span>
        </div>
      </div>
    </header>
  );
}
