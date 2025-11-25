import React from 'react';
import Logo from './Logo';

const Footer: React.FC = () => {
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const href = e.currentTarget.getAttribute('href');
    if (!href) return;
    // Special case for admin link
    if (href === '/admin/') {
      window.location.href = href;
      return;
    }
    const targetId = href.replace('#', '');
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  return (
    <footer className="bg-slate-900/50 border-t border-slate-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left">
          <div className="mb-4 md:mb-0">
            <a href="#home" onClick={handleSmoothScroll}>
              <Logo className="h-8 w-auto mx-auto md:mx-0" />
            </a>
          </div>
          <p className="text-slate-400 text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Montford Digital. All Rights Reserved.
          </p>
          <a href="/admin/" className="text-slate-500 hover:text-cyan-400 text-sm transition-colors duration-300">
            Admin Login
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;