import React from 'react';

const plans = [
  { name: 'Free', price: '$0', features: ['3 projects', '500MB storage', 'Community support'], cta: 'Start Free' },
  { name: 'Pro', price: '$19', features: ['Unlimited projects', '5GB storage', 'Priority support', 'Custom domain'], cta: 'Upgrade to Pro', popular: true },
  { name: 'Team', price: '$49', features: ['Everything in Pro', 'Team collaboration', '50GB storage', 'Admin controls', 'Analytics'], cta: 'Contact Sales' },
];

export default function PricingCardsV2() {
  return (
    <div style={{ padding: 64, background: '#faf9f6', fontFamily: '-apple-system, sans-serif', textAlign: 'center' }}>
      <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Simple, transparent pricing</h2>
      <p style={{ color: '#666', marginBottom: 48 }}>No hidden fees. Cancel anytime.</p>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
        {plans.map((plan) => (
          <div key={plan.name} style={{
            width: 300,
            padding: 36,
            background: '#fff',
            borderRadius: 16,
            border: plan.popular ? '2px solid #2563eb' : '1px solid #e5e5e5',
            textAlign: 'left',
            position: 'relative',
          }}>
            {plan.popular && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#2563eb', color: '#fff', padding: '2px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Most Popular</div>}
            <div style={{ fontSize: 18, fontWeight: 700 }}>{plan.name}</div>
            <div style={{ fontSize: 42, fontWeight: 800, margin: '8px 0' }}>{plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: '#999' }}>/mo</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0' }}>
              {plan.features.map((f) => <li key={f} style={{ padding: '5px 0', fontSize: 14, color: '#444' }}>✓ {f}</li>)}
            </ul>
            <button style={{ width: '100%', padding: 12, borderRadius: 8, background: plan.popular ? '#2563eb' : '#f4f4f5', color: plan.popular ? '#fff' : '#1a1a1a', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{plan.cta}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
