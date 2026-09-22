export const metadata = { title: 'Help · payUnexa' };

export default function Help() {
  return (
    <>
      <h1>Help Center</h1>
      <p className="updated">Frequently asked questions</p>

      <h3>How do I pay using a payment link?</h3>
      <p>Open the link you were sent, enter your details and amount, choose a payment method
        (card, wallet, or pay later), review, and place your order. You&apos;ll see a confirmation
        once the payment is verified.</p>

      <h3>Which payment methods are accepted?</h3>
      <p>Cards (Visa, Mastercard, American Express, RuPay, Discover — availability varies by
        country), popular wallets, and payUnexa Pay Later. The options shown adjust to your
        selected country.</p>

      <h3>Is my card information safe?</h3>
      <p>Yes. Your full card number and CVC never leave your browser. See our
        <a href="/security"> Security</a> page for details.</p>

      <h3>My payment is stuck on &quot;processing&quot;.</h3>
      <p>Payments may be manually verified. Keep the page open — the status updates automatically
        once confirmed. If it does not resolve, contact us with your reference.</p>

      <h3>How do I get a refund?</h3>
      <p>See our <a href="/refund-policy">Refund &amp; Cancellation</a> policy.</p>

      <h3>Still need help?</h3>
      <p>Reach our team via the <a href="/contact">Contact Us</a> page.</p>
    </>
  );
}
