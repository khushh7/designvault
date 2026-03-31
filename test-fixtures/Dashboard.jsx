import React from 'react';

export default function Dashboard() {
  const stats = [
    { label: 'Total Revenue', value: '$45,231', change: '+20.1%' },
    { label: 'Active Users', value: '2,350', change: '+15.3%' },
    { label: 'Conversion Rate', value: '3.24%', change: '+2.4%' },
    { label: 'Avg. Order Value', value: '$89.50', change: '-1.2%' },
  ];

  return (
    <div style={{ padding: 32, fontFamily: '-apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            padding: 20,
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e5e5',
          }}>
            <div style={{ fontSize: 13, color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 13, color: s.change.startsWith('+') ? '#16a34a' : '#dc2626', marginTop: 4 }}>
              {s.change} from last month
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
