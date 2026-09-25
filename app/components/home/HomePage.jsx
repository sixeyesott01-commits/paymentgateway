'use client';

import { useEffect, useRef, useState } from 'react';
import './home.css';

const YEAR = 2026;

/* Scroll-reveal wrapper */
function Reveal({ children, className = '', as: Tag = 'div', style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el); } }),
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${className}`} style={style}>{children}</Tag>;
}

const Logo = ({ className = 'brand' }) => (
  <span className={className} aria-label="payUnexa"><span className="pay">pay</span><span className="unexa">Unexa</span></span>
);

/* ---------------- Navbar ---------------- */
function Navbar() {
  const [open, setOpen] = useState(false);
  const links = ['Products', 'Solutions', 'Developers', 'Pricing', 'Resources'];
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a href="#top"><Logo /></a>
        <nav className="nav-links">{links.map((l) => <a key={l} href={`#${l.toLowerCase()}`}>{l}</a>)}</nav>
        <div className="nav-right">
          <a className="signin" href="/admin">Sign in</a>
          <a className="sales" href="#contact">Contact sales</a>
          <a className="btn btn-primary btn-sm" href="#get-started">Get started</a>
          <button className={`nav-toggle ${open ? 'open' : ''}`} aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
      <div className={`mobile-menu ${open ? 'open' : ''}`}>
        <div className="wrap">
          {links.map((l) => <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setOpen(false)}>{l}</a>)}
          <a href="/admin" onClick={() => setOpen(false)}>Sign in</a>
          <div className="mm-cta">
            <a className="btn btn-ghost btn-sm" href="#contact" onClick={() => setOpen(false)}>Contact sales</a>
            <a className="btn btn-primary btn-sm" href="#get-started" onClick={() => setOpen(false)}>Get started</a>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero network backdrop ---------------- */
function HeroNet() {
  // Abstract payment-network: nodes + routing lines, subtle motion.
  const nodes = [
    [120, 90], [300, 60], [520, 120], [760, 70], [980, 110], [1160, 80],
    [200, 260], [440, 300], [680, 250], [900, 300], [1080, 260],
    [340, 440], [600, 470], [860, 440],
  ];
  const links = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10],
    [6, 7], [7, 8], [8, 9], [9, 10], [6, 11], [7, 12], [8, 12], [9, 13], [11, 12], [12, 13],
  ];
  return (
    <svg className="hero-net" viewBox="0 0 1280 540" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="hl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1268ed" stopOpacity="0.35" />
          <stop offset="1" stopColor="#1268ed" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke="url(#hl)" strokeWidth="1.2" />
      ))}
      {links.slice(0, 8).map(([a, b], i) => (
        <line key={`f${i}`} className="flow" x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke="#f59b0b" strokeWidth="1.6" strokeDasharray="4 200" strokeLinecap="round"
          style={{ animation: `uxdash 3.4s linear ${i * 0.4}s infinite` }} />
      ))}
      {nodes.map(([x, y], i) => (
        <g key={`n${i}`}>
          <circle cx={x} cy={y} r={i % 4 === 0 ? 5 : 3.2} fill={i % 4 === 0 ? '#1268ed' : '#9db8e6'} />
          {i % 4 === 0 && <circle cx={x} cy={y} r="5" fill="none" stroke="#1268ed" strokeOpacity="0.4">
            <animate attributeName="r" values="5;13;5" dur="3s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="3s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
          </circle>}
        </g>
      ))}
      <style>{`@keyframes uxdash{to{stroke-dashoffset:-204}}`}</style>
    </svg>
  );
}

/* ---------------- Hero ---------------- */
function Hero() {
  return (
    <section className="hero" id="top">
      <HeroNet />
      <div className="wrap hero-inner">
        <Reveal>
          <span className="hero-badge"><span className="dot" /> Payment infrastructure for modern businesses</span>
        </Reveal>
        <Reveal as="h1">Move money with clarity.<br /><span className="grad">Build payments without friction.</span></Reveal>
        <Reveal className="lead">payUnexa gives businesses the infrastructure to accept, manage, and scale digital payments through a simple, reliable payment platform.</Reveal>
        <Reveal className="hero-cta">
          <a className="btn btn-accent" href="#get-started">Start building →</a>
          <a className="btn btn-ghost" href="#platform">Explore platform</a>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Trust strip ---------------- */
function TrustStrip() {
  const cats = ['E-commerce', 'SaaS', 'Digital products', 'Marketplaces', 'Services'];
  return (
    <section className="trust">
      <div className="wrap">
        <div className="trust-title">Built for businesses that move money every day.</div>
        <div className="trust-row">{cats.map((c) => <span key={c}>{c}</span>)}</div>
      </div>
    </section>
  );
}

/* ---------------- Product cards ---------------- */
function ProductCard({ title, desc, children }) {
  return (
    <Reveal className="prod-card">
      <div className="prod-visual">{children}</div>
      <h3 style={{ marginTop: 20 }}>{title}</h3>
      <p>{desc}</p>
    </Reveal>
  );
}

function ProductSection() {
  return (
    <section className="section" id="products">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow">Platform</span>
          <h2>One platform. Every payment flow.</h2>
        </div>
        <div className="prod-grid" id="platform">
          <ProductCard title="Accept payments" desc="Create seamless checkout experiences across web and mobile.">
            <div className="mini-row"><span className="mini-amt">$249.00</span><span className="mini-pill">Secure</span></div>
            <div className="mini-field">you@example.com</div>
            <div className="co-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="mini-field">Card number</div><div className="mini-field">MM/YY</div>
            </div>
            <div className="mini-btn">Pay $249.00</div>
          </ProductCard>

          <ProductCard title="Payment links" desc="Share a payment experience without building a complete checkout.">
            <div className="mini-row"><span className="mini-chip">payunexa.link/inv-4821</span><span className="mini-pill">Paid</span></div>
            <div className="mini-row" style={{ marginTop: 6 }}><span className="mini-muted">Customer</span><span style={{ fontWeight: 600, fontSize: 12 }}>Aria Nakamura</span></div>
            <div className="mini-row"><span className="mini-muted">Amount</span><span className="mini-amt" style={{ fontSize: 16 }}>$1,200.00</span></div>
            <div className="mini-btn" style={{ background: '#0a2540' }}>Copy link</div>
          </ProductCard>

          <ProductCard title="Developer APIs" desc="Build payment experiences directly into your applications.">
            <div className="code-mini">
              <div><span className="c">// create a payment</span></div>
              <div><span className="k">const</span> p = <span className="k">await</span> payUnexa.payments.<span className="p">create</span>(&#123;</div>
              <div>&nbsp;&nbsp;amount: <span className="s">2500</span>,</div>
              <div>&nbsp;&nbsp;currency: <span className="s">&quot;USD&quot;</span>,</div>
              <div>&#125;);</div>
            </div>
          </ProductCard>

          <ProductCard title="Transaction management" desc="Track payment activity, statuses and operational workflows from one place.">
            <div className="tl">
              <div className="tl-item"><span className="tl-dot ok">✓</span><span>Payment captured · $840.00</span></div>
              <div className="tl-item"><span className="tl-dot ok">✓</span><span>Refund issued · $60.00</span></div>
              <div className="tl-item"><span className="tl-dot now">•</span><span>Authorizing · $1,299.00</span></div>
              <div className="tl-item"><span className="tl-dot wait">•</span><span>Pending settlement</span></div>
            </div>
          </ProductCard>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Developer section ---------------- */
function DeveloperSection() {
  const steps = [
    ['Payment created', 'done'], ['Checkout opened', 'done'], ['Customer authenticated', 'on'],
    ['Payment processed', 'wait'], ['Payment successful', 'wait'],
  ];
  return (
    <section className="section dev" id="developers">
      <div className="wrap">
        <Reveal className="sec-head">
          <span className="eyebrow" style={{ color: '#7fb0ff' }}>Developers</span>
          <h2>Payments should feel simple to integrate.</h2>
          <p className="lead">Clean primitives, predictable responses and a developer experience built for shipping quickly.</p>
        </Reveal>
        <div className="dev-grid">
          <Reveal className="code-panel">
            <div className="code-bar"><i /><i /><i /><span className="fn">payments.js</span></div>
            <div className="code-body">
              <div><span className="k">const</span> payment = <span className="k">await</span> payUnexa.payments.<span className="p">create</span>(&#123;</div>
              <div>&nbsp;&nbsp;amount: <span className="n">2500</span>,</div>
              <div>&nbsp;&nbsp;currency: <span className="s">&quot;USD&quot;</span>,</div>
              <div>&nbsp;&nbsp;customer: customerId</div>
              <div>&#125;);</div>
              <div>&nbsp;</div>
              <div><span className="c">// → payment.status === &quot;requires_action&quot;</span></div>
              <div><span className="c">// → redirect customer to payment.url</span></div>
            </div>
          </Reveal>
          <Reveal className="life">
            <h3>Payment lifecycle</h3>
            {steps.map(([label, st], i) => (
              <div key={label} className={`life-step ${st === 'done' ? 'done' : st === 'on' ? 'on' : ''}`}>
                <span className="ls-dot">{st === 'done' ? '✓' : i + 1}</span>
                <span>{label}</span>
                <span className="ls-line" />
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Checkout showcase ---------------- */
function CheckoutShowcase() {
  return (
    <section className="section showcase" id="solutions">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow">Checkout</span>
          <h2>A checkout customers understand.</h2>
          <p className="lead">Clear, focused and designed to keep customers moving.</p>
        </div>
        <Reveal className="browser">
          <div className="browser-bar"><i /><i /><i /><span className="browser-url"><b>🔒</b> app.payunexa.com/pay</span></div>
          <div className="co">
            <div className="co-main">
              <div className="co-brand"><span className="pay">pay</span><span className="unexa">Unexa</span></div>
              <div className="co-amtbox"><span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Amount to pay</span><span className="v">$249.00</span></div>
              <div className="co-h">Customer information</div>
              <div className="co-sub">Enter your information to continue with your payment.</div>
              <div className="co-label">Full name</div><div className="co-field">Jane Doe</div>
              <div className="co-label">Email address</div><div className="co-field">jane@example.com</div>
              <div className="co-label">Phone number</div><div className="co-field">+1 555 018 2245</div>
              <div className="co-label">Card details</div>
              <div className="co-field" style={{ marginBottom: 10 }}>1234 5678 9012 3456</div>
              <div className="co-2"><div className="co-field">MM / YY</div><div className="co-field">CVV</div></div>
              <div className="co-pay">Pay $249.00</div>
            </div>
            <div className="co-side">
              <div className="co-h" style={{ marginTop: 0 }}>Order summary</div>
              <div className="co-srow"><span>Amount</span><span>$249.00</span></div>
              <div className="co-srow"><span>Fees</span><span>$0.00</span></div>
              <div className="co-srow total"><span>Total</span><span>$249.00</span></div>
              <div style={{ marginTop: 18 }}>
                <div className="co-trust"><span className="co-check">✓</span> 256-bit TLS encryption</div>
                <div className="co-trust"><span className="co-check">✓</span> PCI-DSS aligned processing</div>
                <div className="co-trust"><span className="co-check">✓</span> Card details tokenized</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Security ---------------- */
const IcoShield = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.7-2.8 8.1-7 10-4.2-1.9-7-5.3-7-10V6l7-3z" /><path d="m8.8 12 2.1 2.1 4.4-4.7" /></svg>);
const IcoLock = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>);
const IcoActivity = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>);
const IcoApi = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14" /></svg>);

function SecuritySection() {
  const blocks = [
    [<IcoLock key="l" />, 'Secure data transmission', 'Sensitive payment data is encrypted in transit across every request.'],
    [<IcoShield key="s" />, 'Payment authentication', 'Support for step-up authentication like 3-D Secure where required.'],
    [<IcoActivity key="a" />, 'Transaction monitoring', 'Follow payment activity and statuses across the full lifecycle.'],
    [<IcoApi key="p" />, 'Developer controls', 'Scoped keys and clear APIs to manage how payments are created.'],
  ];
  return (
    <section className="section" id="security">
      <div className="wrap">
        <Reveal className="sec-head">
          <span className="eyebrow">Infrastructure</span>
          <h2>Infrastructure designed around every transaction.</h2>
        </Reveal>
        <div className="sec-grid">
          {blocks.map(([ico, title, desc]) => (
            <Reveal className="sec-block" key={title}>
              <div className="sec-ico">{ico}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Global network ---------------- */
function GlobalNetwork() {
  const pts = [
    [180, 150], [360, 110], [560, 170], [720, 120], [880, 180],
    [260, 280], [480, 250], [660, 300], [840, 260],
    [400, 380], [620, 400],
  ];
  const arcs = [[1, 3], [3, 4], [0, 1], [0, 5], [5, 6], [6, 2], [2, 3], [6, 7], [7, 8], [8, 4], [5, 9], [9, 10], [10, 7]];
  const curve = (a, b) => {
    const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 40;
    return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
  };
  return (
    <section className="section globe" id="resources">
      <div className="wrap">
        <Reveal className="sec-head center">
          <span className="eyebrow">Global</span>
          <h2>One payment layer for a connected world.</h2>
          <p className="lead">Route, process and reconcile payments across regions from a single platform.</p>
        </Reveal>
        <Reveal className="globe-map">
          <svg viewBox="0 0 1040 480" aria-hidden="true">
            <defs>
              <radialGradient id="gg" cx="50%" cy="30%" r="70%">
                <stop offset="0" stopColor="#eaf2ff" /><stop offset="1" stopColor="#ffffff" />
              </radialGradient>
              <linearGradient id="ga" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#1268ed" stopOpacity="0.15" /><stop offset="0.5" stopColor="#1268ed" stopOpacity="0.6" /><stop offset="1" stopColor="#f59b0b" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="1040" height="480" fill="url(#gg)" rx="20" />
            {/* subtle dotted grid */}
            {Array.from({ length: 12 }).map((_, r) => Array.from({ length: 26 }).map((_, c) => (
              <circle key={`${r}-${c}`} cx={30 + c * 38} cy={40 + r * 34} r="1.4" fill="#c9d6ea" opacity="0.5" />
            )))}
            {arcs.map(([a, b], i) => (
              <path key={i} d={curve(a, b)} fill="none" stroke="url(#ga)" strokeWidth="1.6"
                strokeDasharray="5 220" strokeLinecap="round"
                style={{ animation: `uxdash2 4s linear ${i * 0.35}s infinite` }} />
            ))}
            {arcs.map(([a, b], i) => (
              <path key={`b${i}`} d={curve(a, b)} fill="none" stroke="#c7d7f0" strokeWidth="1" opacity="0.55" />
            ))}
            {pts.map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={i % 3 === 0 ? 6 : 4} fill={i % 3 === 0 ? '#1268ed' : '#f59b0b'} />
                <circle cx={x} cy={y} r={i % 3 === 0 ? 6 : 4} fill="none" stroke={i % 3 === 0 ? '#1268ed' : '#f59b0b'} strokeOpacity="0.4">
                  <animate attributeName="r" values={`${i % 3 === 0 ? 6 : 4};16;${i % 3 === 0 ? 6 : 4}`} dur="3.2s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="3.2s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
                </circle>
              </g>
            ))}
            <style>{`@keyframes uxdash2{to{stroke-dashoffset:-225}}`}</style>
          </svg>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */
function FinalCTA() {
  return (
    <section className="cta" id="get-started">
      <div className="wrap">
        <Reveal className="cta-box">
          <h2>Ready to build a better payment experience?</h2>
          <p className="lead">Start integrating payUnexa and build payments into your product with less friction.</p>
          <div className="hero-cta">
            <a className="btn btn-accent" href="#get-started">Get started →</a>
            <a className="btn btn-ghost" href="#contact" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>Talk to our team</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Footer() {
  const cols = [
    ['Product', [['Payments', '#products'], ['Checkout', '#solutions'], ['Payment Links', '#products'], ['Pricing', '#pricing']]],
    ['Solutions', [['E-commerce', '#solutions'], ['SaaS', '#solutions'], ['Marketplaces', '#solutions'], ['Services', '#solutions']]],
    ['Developers', [['API', '#developers'], ['Documentation', '#developers'], ['Status', '#developers']]],
    ['Company', [['About', '#'], ['Contact', '/contact'], ['Careers', '#']]],
    ['Legal', [['Privacy', '/privacy'], ['Terms', '/conditions-of-use'], ['Refund Policy', '/refund-policy'], ['Security', '/security']]],
  ];
  return (
    <footer className="foot" id="contact">
      <div className="wrap">
        <div className="foot-top">
          <div className="foot-brand">
            <Logo />
            <p>Payment infrastructure to accept, manage and scale digital payments.</p>
          </div>
          {cols.map(([h, links]) => (
            <div className="foot-col" key={h}>
              <h4>{h}</h4>
              {links.map(([t, href]) => <a key={t} href={href}>{t}</a>)}
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span>© {YEAR} payUnexa Technologies. All rights reserved.</span>
          <span>Payments secured with 256-bit TLS</span>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="ux">
      <Navbar />
      <main>
        <Hero />
        <TrustStrip />
        <ProductSection />
        <DeveloperSection />
        <CheckoutShowcase />
        <SecuritySection />
        <GlobalNetwork />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
