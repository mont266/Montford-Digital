
import React, { useState, useEffect } from 'react';

// --- Scramble Text Component ---
const ScrambleText: React.FC = () => {
  const phrases = [
    "Digital Experiences",
    "Web Applications",
    "Mobile Solutions",
    "Bespoke Systems"
  ];
  const [text, setText] = useState(phrases[0]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const chars = "!<>-_\\/[]{}—=+*^?#________";

  useEffect(() => {
    let frameId: number;
    const targetPhrase = phrases[phraseIndex];
    let iteration = 0;
    
    const animate = () => {
      setText(
        targetPhrase
          .split("")
          .map((letter, index) => {
            if (index < iteration) {
              return targetPhrase[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );

      if (iteration < targetPhrase.length) {
        iteration += 1 / 3; // Speed of reveal
        frameId = requestAnimationFrame(animate);
      }
    };

    const startAnimation = () => {
        frameId = requestAnimationFrame(animate);
    }
    
    // Start animation immediately when phrase changes
    startAnimation();

    const timeoutId = setTimeout(() => {
        // Move to next phrase after delay
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 4000); // Time to stay on word

    return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(timeoutId);
    };
  }, [phraseIndex]);

  return <span className="text-cyan-400 font-mono min-h-[1.2em] inline-block">{text}</span>;
};


// --- Parallax Background Component ---
interface ParallaxProps {
    mouseX: number;
    mouseY: number;
}

const AnimatedHeroBackground: React.FC<ParallaxProps> = ({ mouseX, mouseY }) => {
    // Calculate parallax offsets (default to center if no mouse event yet)
    const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
    
    // Parallax intensity factors
    const moveX = (mouseX - centerX) * 0.02; 
    const moveY = (mouseY - centerY) * 0.02;

    return (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1920 1080">
                <defs>
                    <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" style={{stopColor: 'rgba(6, 182, 212, 0.15)', stopOpacity: 1}} />
                        <stop offset="100%" style={{stopColor: 'rgba(8, 47, 73, 0)', stopOpacity: 1}} />
                    </radialGradient>
                    <style>
                        {`
                        @keyframes rotate {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        @keyframes rotate-reverse {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(-360deg); }
                        }
                        .orbit {
                            animation-duration: 60s;
                            animation-iteration-count: infinite;
                            animation-timing-function: linear;
                            transform-origin: center;
                        }
                        `}
                    </style>
                </defs>
                <rect width="1920" height="1080" fill="url(#grad1)" />
                
                {/* Layer 1: Distant / Slower movement */}
                <g style={{ transform: `translate(${moveX * 0.5}px, ${moveY * 0.5}px)`, transition: 'transform 0.1s ease-out' }}>
                    <g transform="translate(960, 540)">
                         {/* Main Orbits */}
                        <g className="orbit" style={{animationName: 'rotate', animationDuration: '90s'}}>
                            <circle cx="0" cy="-400" r="8" fill="#06b6d4" opacity="0.6"/>
                            <circle cx="400" cy="0" r="6" fill="#22d3ee" opacity="0.5"/>
                        </g>
                         <g className="orbit" style={{animationName: 'rotate-reverse', animationDuration: '70s'}}>
                            <circle cx="0" cy="-250" r="5" fill="#67e8f9" opacity="0.7"/>
                            <circle cx="250" cy="0" r="7" fill="#06b6d4" opacity="0.6"/>
                        </g>
                    </g>
                </g>

                {/* Layer 2: Closer / Faster movement */}
                <g style={{ transform: `translate(${moveX * 1.2}px, ${moveY * 1.2}px)`, transition: 'transform 0.1s ease-out' }}>
                    <g transform="translate(960, 540)">
                        <g className="orbit" style={{animationName: 'rotate', animationDuration: '50s'}}>
                            <circle cx="0" cy="-150" r="4" fill="#a5f3fc" opacity="0.8"/>
                        </g>
                        {/* Additional floating particles for depth */}
                        <circle cx="-600" cy="300" r="3" fill="#22d3ee" opacity="0.3" />
                        <circle cx="700" cy="-400" r="2" fill="#22d3ee" opacity="0.2" />
                        <circle cx="-800" cy="-200" r="4" fill="#06b6d4" opacity="0.1" />
                    </g>
                </g>
            </svg>
        </div>
    );
}


const Hero: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Initialize center position to avoid jump on load
    setMousePos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    const handleMouseMove = (e: MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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
  
  return (
    <section id="home" className="relative flex items-center justify-center h-screen bg-slate-900 overflow-hidden">
      <AnimatedHeroBackground mouseX={mousePos.x} mouseY={mousePos.y} />
      
      <div className="relative z-10 text-center px-4 w-full max-w-5xl mx-auto">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-4">
          Crafting Exceptional
          <br />
          <ScrambleText />
        </h1>
        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-300 mb-8 mt-6">
          We build beautiful, functional, and high-performing websites that drive results and elevate your brand.
        </p>
        <div className="flex justify-center space-x-4">
          <a href="#portfolio" onClick={handleSmoothScroll} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-500/20">
            View Our Work
          </a>
          <a href="#about" onClick={handleSmoothScroll} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-slate-700/20">
            Learn More
          </a>
        </div>
      </div>
       <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
            <a href="#about" onClick={handleSmoothScroll} aria-label="Scroll down">
                <svg className="w-8 h-8 text-cyan-400 animate-bounce" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
            </a>
        </div>
    </section>
  );
};

export default Hero;
