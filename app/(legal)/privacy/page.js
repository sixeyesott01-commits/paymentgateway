export const metadata = { title: 'Privacy Notice · payUnexa' };

export default function Privacy() {
  return (
    <>
      <h1>Privacy Notice</h1>
      <p className="updated">Last updated: {new Date().getFullYear()}</p>

      <p>This Privacy Notice explains what personal data payUnexa collects at checkout, how we use
        it, and the choices you have.</p>

      <h3>Information we collect</h3>
      <ul>
        <li><b>Contact details</b> — name, email, WhatsApp/phone number.</li>
        <li><b>Billing details</b> — address and postal code, country.</li>
        <li><b>Payment metadata</b> — card brand, last 4 digits, expiry, and name on card only.
          We <b>never</b> receive or store your full card number (PAN) or CVC — these stay in your
          browser and are never transmitted to our servers.</li>
        <li><b>Technical data</b> — IP address, device and browser information for fraud prevention.</li>
      </ul>

      <h3>How we use it</h3>
      <ul>
        <li>To process and verify your payment.</li>
        <li>To detect and prevent fraud and abuse.</li>
        <li>To provide support and send transaction confirmations.</li>
        <li>To comply with legal and regulatory obligations.</li>
      </ul>

      <h3>Sharing</h3>
      <p>We share data with the merchant you are paying, payment networks, and banks strictly to
        complete your transaction. We do not sell your personal data.</p>

      <h3>Retention</h3>
      <p>We retain transaction records only as long as needed for the purposes above and to meet
        legal requirements, then delete or anonymise them.</p>

      <h3>Your rights</h3>
      <p>Depending on your jurisdiction you may have rights to access, correct, or delete your data.
        Contact us via the <a href="/contact">Contact Us</a> page to exercise them.</p>
    </>
  );
}
