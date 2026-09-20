'use client';

import { useCallback, useEffect, useState } from 'react';

function money(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
  }).format(Number(amount));
}

export default function Admin() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState([]);
  const [amount, setAmount] = useState('');
  const [service, setService] = useState('');
  const [newLink, setNewLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (t) {
      setToken(t);
      setAuthed(true);
    }
  }, []);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, 'content-type': 'application/json' }),
    [token]
  );

  const load = useCallback(async () => {
    setError('');
    const res = await fetch('/api/orders', { headers: authHeaders() });
    if (res.status === 401) {
      setError('Invalid admin token.');
      setAuthed(false);
      localStorage.removeItem('admin_token');
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load orders.');
      return;
    }
    setOrders(data.orders || []);
  }, [authHeaders]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  function saveToken(e) {
    e.preventDefault();
    localStorage.setItem('admin_token', token);
    setAuthed(true);
  }

  async function createOrder(e) {
    e.preventDefault();
    setError('');
    setNewLink('');
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ amount, service_name: service }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to create order.');
      return;
    }
    setNewLink(data.link);
    setAmount('');
    setService('');
    load();
  }

  async function setStatus(slug, action) {
    setError('');
    const res = await fetch(`/api/orders/${slug}/status`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || `Failed to ${action}.`);
    load();
  }

  if (!authed) {
    return (
      <div className="container">
        <div className="card">
          <h1>Admin access</h1>
          <h2>Enter the admin token (ADMIN_TOKEN from your env)</h2>
          <form onSubmit={saveToken}>
            <label>Admin token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••••••••"
            />
            {error && <div className="msg err">{error}</div>}
            <button type="submit">Unlock</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container wide">
      <div className="card">
        <h1>New payment link</h1>
        <h2>Enter an amount and what it&apos;s for — get a link to send the customer</h2>
        <form onSubmit={createOrder}>
          <div className="row">
            <div>
              <label>Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="49.99"
              />
            </div>
            <div>
              <label>Service name</label>
              <input
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="Website design"
              />
            </div>
          </div>
          <button type="submit">Create payment link</button>
        </form>
        {newLink && (
          <>
            <label>Send this link to the customer:</label>
            <div className="link-box">{newLink}</div>
            <button
              className="ghost small"
              style={{ marginTop: 10 }}
              onClick={() => navigator.clipboard.writeText(newLink)}
            >
              Copy link
            </button>
          </>
        )}
        {error && <div className="msg err">{error}</div>}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h1>Orders</h1>
        <h2>Review the customer&apos;s details, confirm the payment, then activate</h2>
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Service</th>
              <th>Amount</th>
              <th>Customer</th>
              <th>Card</th>
              <th>Reference</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{new Date(o.created_at).toLocaleString()}</td>
                <td>{o.service_name}</td>
                <td>{money(o.amount_usd, o.currency)}</td>
                <td>
                  {o.customer_name ? (
                    <>
                      {o.customer_name}
                      <br />
                      <span className="muted">{o.customer_email}</span>
                      <br />
                      <span className="muted">
                        {o.customer_whatsapp} {o.customer_country ? `· ${o.customer_country}` : ''}
                      </span>
                      {(o.customer_address1 || o.customer_zip) && (
                        <>
                          <br />
                          <span className="muted">
                            {[o.customer_address1, o.customer_address2, o.customer_zip]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="muted">— not submitted yet —</span>
                  )}
                </td>
                <td>
                  {o.card_last4 ? (
                    <>
                      {o.card_brand} •••• {o.card_last4}
                      <br />
                      <span className="muted">
                        {o.card_exp_month}/{o.card_exp_year}
                      </span>
                      {o.card_name && (
                        <>
                          <br />
                          <span className="muted">{o.card_name}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="mono">{o.reference || '—'}</td>
                <td>
                  <span className={`badge ${o.status}`}>{o.status}</span>
                </td>
                <td>
                  {o.status === 'submitted' && (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="small" onClick={() => setStatus(o.slug, 'paid')}>
                        ✔ Mark paid
                      </button>
                      <button className="small danger" onClick={() => setStatus(o.slug, 'cancel')}>
                        ✕ Cancel
                      </button>
                    </div>
                  )}
                  {o.status === 'created' && (
                    <button className="small ghost" onClick={() => setStatus(o.slug, 'cancel')}>
                      Cancel link
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="muted center">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <button className="ghost small" style={{ marginTop: 16 }} onClick={load}>
          Refresh
        </button>
      </div>
    </div>
  );
}
