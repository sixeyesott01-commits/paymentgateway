export const metadata = { title: 'Conditions of Use · payUnexa' };

export default function ConditionsOfUse() {
  return (
    <>
      <h1>Conditions of Use</h1>
      <p className="updated">Last updated: {new Date().getFullYear()}</p>

      <p>Welcome to payUnexa. By accessing or using our payment services you agree to these
        Conditions of Use. Please read them carefully. If you do not agree, do not use the service.</p>

      <h3>1. The service</h3>
      <p>payUnexa provides hosted payment links and checkout that let merchants collect payments
        from their customers. We act as a payment technology provider and are not a party to the
        underlying sale of goods or services between a merchant and a customer.</p>

      <h3>2. Eligibility</h3>
      <p>You must be at least 18 years old and able to form a legally binding contract to use the
        service. You are responsible for the accuracy of the information you submit at checkout.</p>

      <h3>3. Acceptable use</h3>
      <ul>
        <li>Do not use the service for unlawful, fraudulent, or prohibited transactions.</li>
        <li>Do not attempt to probe, scan, or breach the security of the platform.</li>
        <li>Do not submit payment credentials that are not yours or that you are not authorised to use.</li>
      </ul>

      <h3>4. Payments &amp; verification</h3>
      <p>Transactions may be subject to manual review, risk scoring, and 3-D Secure authentication.
        We may decline, hold, or reverse a payment where we reasonably suspect fraud or a breach of
        these terms.</p>

      <h3>5. Limitation of liability</h3>
      <p>To the maximum extent permitted by law, payUnexa is not liable for indirect or consequential
        losses arising from your use of the service. Nothing in these terms excludes liability that
        cannot be excluded under applicable law.</p>

      <h3>6. Changes</h3>
      <p>We may update these Conditions of Use from time to time. Continued use of the service after
        changes take effect constitutes acceptance of the revised terms.</p>

      <p>Questions? See our <a href="/help">Help</a> page or <a href="/contact">Contact Us</a>.</p>
    </>
  );
}
