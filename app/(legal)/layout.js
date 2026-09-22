import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';

export default function LegalLayout({ children }) {
  return (
    <>
      <SiteHeader title="payUnexa" />
      <main className="legal">
        <div className="card">{children}</div>
        <a className="back" href="/">← Back to home</a>
      </main>
      <SiteFooter />
    </>
  );
}
