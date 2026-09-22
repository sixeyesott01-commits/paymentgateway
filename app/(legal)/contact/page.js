export const metadata = { title: 'Contact Us · payUnexa' };

export default function Contact() {
  return (
    <>
      <h1>Contact Us</h1>
      <p className="updated">We&apos;re here to help</p>

      <p>Have a question about a payment, a refund, or your account? Get in touch and include your
        payment reference where possible so we can help faster.</p>

      <h3>Support</h3>
      <ul>
        <li><b>Email:</b> support@payunexa.example</li>
        <li><b>WhatsApp:</b> +1 555 000 0000</li>
        <li><b>Hours:</b> Monday–Saturday, 9:00–18:00</li>
      </ul>

      <h3>Security &amp; abuse</h3>
      <p>To report fraud or a security vulnerability, email security@payunexa.example. See our
        <a href="/security"> Security</a> page for our disclosure process.</p>

      <h3>Business address</h3>
      <p>payUnexa Technologies<br />(Registered office details available on request.)</p>
    </>
  );
}
