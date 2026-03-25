
import React from 'react';
import { motion } from 'motion/react';

const About: React.FC = () => {
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
    <section id="about" className="py-20 sm:py-32 bg-slate-900/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              About Us
            </h2>
            <div className="w-24 h-1 bg-cyan-400 mb-6"></div>
            <p className="text-lg text-slate-300 mb-4">
              At <strong className="text-white">Montford Digital</strong>, our mission is clear: to bring a fresh, engineering-first approach to the digital landscape. We are a dynamic development agency dedicated to building software that fits your business perfectly.
            </p>
            <p className="text-lg text-slate-300 mb-6">
              We don't believe in forcing your unique requirements into rigid, out-of-the-box templates. We avoid over-reliance on heavy third-party solutions that bloat your site and limit your growth. Instead, we specialise in crafting <strong>tailor-made systems</strong> from the ground up, ensuring your web or mobile application is fast, scalable, and built specifically for you.
            </p>
             <a href="#contact" onClick={handleSmoothScroll} className="text-cyan-400 font-bold text-lg hover:text-cyan-300 transition-colors duration-300">
              Let's build something unique &rarr;
            </a>
          </div>
          <div className="order-1 md:order-2 flex justify-center items-center">
            <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
              {/* Background glow */}
              <div className="absolute inset-0 bg-cyan-500/10 blur-[100px] rounded-full" />
              
              {/* Outer rotating dashed ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute w-full h-full border-[1px] border-dashed border-cyan-500/30 rounded-full"
              />
              
              {/* Inner rotating ring (opposite direction) */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute w-3/4 h-3/4 border-[1px] border-slate-700 rounded-full flex items-center justify-center"
              >
                {/* Orbiting nodes */}
                <div className="absolute -top-1.5 w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                <div className="absolute -bottom-1.5 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
              </motion.div>

              {/* Center pulsing core */}
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-1/3 h-1/3 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full shadow-[0_0_40px_rgba(34,211,238,0.4)] flex items-center justify-center"
              >
                <div className="w-1/2 h-1/2 bg-white/20 rounded-full blur-sm" />
              </motion.div>

              {/* Floating particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [0, -30, 0],
                    x: [0, i % 2 === 0 ? 15 : -15, 0],
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0]
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                    ease: "easeInOut"
                  }}
                  className={`absolute w-2 h-2 rounded-full ${i % 2 === 0 ? 'bg-cyan-400' : 'bg-blue-400'}`}
                  style={{
                    top: `${20 + (i * 12)}%`,
                    left: `${15 + (i * 14)}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;