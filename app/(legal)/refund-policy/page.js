export const metadata = { title: 'Refund & Cancellation · payUnexa' };

export default function RefundPolicy() {
  return (
    <>
      <h1>Refund &amp; Cancellation Policy</h1>
      <p className="updated">Last updated: {new Date().getFullYear()}</p>

      <p>payUnexa is a payment technology provider. Refunds and cancellations for a purchase are
        governed primarily by the policy of the merchant you paid. This page explains how refunds
        are processed through our platform.</p>

      <h3>Requesting a refund</h3>
      <p>Contact the merchant you paid, or reach us via the <a href="/contact">Contact Us</a> page
        with your payment reference. Refund requests are reviewed against the merchant&apos;s policy.</p>

      <h3>Processing time</h3>
      <ul>
        <li>Approved refunds are initiated within 3–5 business days.</li>
        <li>The amount typically reflects on your original payment method within 5–10 business days,
          depending on your bank or wallet provider.</li>
      </ul>

      <h3>Cancellations</h3>
      <p>A payment link that has not yet been paid can be cancelled by the merchant at any time.
        Once a payment is confirmed, cancellation is treated as a refund request.</p>

      <h3>Failed &amp; duplicate payments</h3>
      <p>If a payment fails but an amount was debited, or you were charged more than once, contact us
        with your reference — verified duplicate or failed charges are refunded in full.</p>
    </>
  );
}
