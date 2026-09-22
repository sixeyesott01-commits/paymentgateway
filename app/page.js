import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';

export default function Home() {
  return (
    <>
      <SiteHeader title="payUnexa" />
      <div className="container">
        <div className="card center">
          <h1>Payment Gateway</h1>
          <p className="muted">
            This is the API + hosting root. There is nothing to see here.
          </p>
          <p className="muted">
            Admins go to <a href="/admin">/admin</a>. Customers open the payment link they were sent.
          </p>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
