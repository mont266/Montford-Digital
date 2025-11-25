
import React, { useState, useEffect } from 'react';
import Logo from './Logo';

const Header: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const href = e.currentTarget.getAttribute('href');
    if (!href) return;
    const targetId = href.replace('#', '');
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { href: '#about', label: 'About' },
    { href: '#services', label: 'Services' },
    { href: '#portfolio', label: 'Work' },
  ];

  const genericHamburgerLine = `h-1 w-6 my-1 rounded-full bg-cyan-400 transition ease transform duration-300`;

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/80 backdrop-blur-sm shadow-lg' : 'bg-transparent'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <a href="#home" onClick={handleSmoothScroll} className="flex-shrink-0">
            <Logo className="h-9 w-auto" />
          </a>
          <nav className="hidden md:block">
            <ul className="flex items-center space-x-8">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} onClick={handleSmoothScroll} className="text-slate-300 hover:text-cyan-400 transition-colors duration-300 font-medium">
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="#contact" onClick={handleSmoothScroll} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105">
                  Get a Quote
                </a>
              </li>
            </ul>
          </nav>
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex flex-col h-12 w-12 border-2 border-cyan-400 rounded justify-center items-center group"
              aria-label="Open menu"
              aria-expanded={isOpen}
            >
              <div className={`${genericHamburgerLine} ${isOpen ? "rotate-45 translate-y-3 opacity-50 group-hover:opacity-100" : "opacity-50 group-hover:opacity-100"}`} />
              <div className={`${genericHamburgerLine} ${isOpen ? "opacity-0" : "opacity-50 group-hover:opacity-100"}`} />
              <div className={`${genericHamburgerLine} ${isOpen ? "-rotate-45 -translate-y-3 opacity-50 group-hover:opacity-100" : "opacity-50 group-hover:opacity-100"}`} />
            </button>
          </div>
        </div>
      </div>
      {/* Mobile Menu */}
      <div className={`md:hidden ${isOpen ? 'block' : 'hidden'} absolute top-20 left-0 w-full bg-slate-900/95 backdrop-blur-md`}>
        <ul className="flex flex-col items-center py-4">
          {navLinks.map((link) => (
            <li key={link.href} className="py-2">
              <a href={link.href} onClick={(e) => { handleSmoothScroll(e); setIsOpen(false); }} className="text-xl text-slate-300 hover:text-cyan-400 transition-colors duration-300">
                {link.label}
              </a>
            </li>
          ))}
          <li className="mt-4">
            <a href="#contact" onClick={(e) => { handleSmoothScroll(e); setIsOpen(false); }} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-full transition-all duration-300 transform hover:scale-105">
              Get a Quote
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
};

export default Header;
