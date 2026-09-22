export const metadata = { title: 'Security · payUnexa' };

export default function Security() {
  return (
    <>
      <h1>Security</h1>
      <p className="updated">Last updated: {new Date().getFullYear()}</p>

      <p>Protecting your payment data is core to how payUnexa is built. Here is how we keep your
        checkout safe.</p>

      <h3>Card data never touches our servers</h3>
      <p>Your full card number and CVC are used only in your browser for local validation. Only the
        card brand, last 4 digits, expiry, and name on card are transmitted — the sensitive
        Primary Account Number (PAN) and CVC are never sent to or stored by payUnexa.</p>

      <h3>Encryption</h3>
      <ul>
        <li>256-bit TLS encryption on every connection.</li>
        <li>Data at rest is encrypted using industry-standard algorithms.</li>
      </ul>

      <h3>Compliance</h3>
      <ul>
        <li>PCI-DSS Level 1 aligned infrastructure.</li>
        <li>3-D Secure (OTP) authentication support.</li>
        <li>Real-time fraud and risk scoring on every transaction.</li>
      </ul>

      <h3>Reporting a vulnerability</h3>
      <p>If you believe you have found a security issue, please report it responsibly via the
        <a href="/contact"> Contact Us</a> page. We investigate every report.</p>
    </>
  );
}
