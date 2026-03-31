import React from 'react';

const plans = [
  { name: 'Starter', price: '$9', features: ['5 projects', '1GB storage', 'Email support'] },
  { name: 'Pro', price: '$29', features: ['Unlimited projects', '10GB storage', 'Priority support', 'API access'], popular: true },
  { name: 'Enterprise', price: '$99', features: ['Everything in Pro', 'SSO', 'Custom integrations', 'Dedicated manager'] },
];

export default function PricingCards() {
  return (
    <div style={{ display: 'flex', gap: 24, padding: 48, justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
      {plans.map((plan) => (
        <div key={plan.name} style={{
          width: 280,
          padding: 32,
          background: plan.popular ? '#1a1a1a' : '#fff',
          color: plan.popular ? '#fff' : '#1a1a1a',
          borderRadius: 16,
          border: plan.popular ? 'none' : '1px solid #e5e5e5',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{plan.name}</div>
          <div style={{ fontSize: 48, fontWeight: 800, margin: '12px 0' }}>{plan.price}<span style={{ fontSize: 16, fontWeight: 400 }}>/mo</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0' }}>
            {plan.features.map((f) => (
              <li key={f} style={{ padding: '6px 0', fontSize: 14 }}>✓ {f}</li>
            ))}
          </ul>
          <button style={{
            width: '100%',
            padding: 12,
            borderRadius: 8,
            border: plan.popular ? 'none' : '1px solid #e5e5e5',
            background: plan.popular ? '#fff' : 'transparent',
            color: plan.popular ? '#1a1a1a' : '#1a1a1a',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Get Started
          </button>
        </div>
      ))}
    </div>
  );
}
