import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = 'h-8 w-auto' }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 285 40" 
      xmlns="http://www.w3.org/2000/svg" 
      aria-label="Montford Digital Logo"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#22d3ee' }} />
          <stop offset="100%" style={{ stopColor: '#14b8a6' }} />
        </linearGradient>
      </defs>
      
      {/* "Prism M" Icon */}
      <g transform="translate(0, 4)">
        <path 
          fill="url(#logoGradient)" 
          d="M0 32 L0 0 L12 0 L16 8 L20 0 L32 0 L32 32 L22 32 L16 20 L10 32 Z" 
        />
      </g>
      
      {/* Wordmark */}
      <text x="45" y="28" fontFamily="sans-serif" fontSize="28" fill="#f1f5f9" fontWeight="bold">
        Montford
        <tspan fill="#94a3b8" fontWeight="normal"> Digital</tspan>
      </text>
    </svg>
  );
};

export default Logo;