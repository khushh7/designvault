import React from 'react';

export default function Button({ children, variant = 'primary', size = 'md', ...props }) {
  const baseStyles = {
    fontFamily: '-apple-system, sans-serif',
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  const variants = {
    primary: { background: '#2563eb', color: '#fff' },
    secondary: { background: '#f4f4f5', color: '#1a1a1a' },
    ghost: { background: 'transparent', color: '#2563eb', border: '1px solid #2563eb' },
    danger: { background: '#dc2626', color: '#fff' },
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: 13 },
    md: { padding: '10px 20px', fontSize: 14 },
    lg: { padding: '14px 28px', fontSize: 16 },
  };

  return (
    <button style={{ ...baseStyles, ...variants[variant], ...sizes[size] }} {...props}>
      {children}
    </button>
  );
}
