
import React from 'react';

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
              Hi, I'm <strong className="text-white">Scott Montford</strong>. I founded Montford Digital with a clear mission: to bring a fresh, engineering-first approach to the digital landscape. We are a new and exciting development agency dedicated to building software that fits your business perfectly.
            </p>
            <p className="text-lg text-slate-300 mb-6">
              We don't believe in forcing your unique requirements into rigid, out-of-the-box templates. We avoid over-reliance on heavy third-party solutions that bloat your site and limit your growth. Instead, we specialise in crafting <strong>tailor-made systems</strong> from the ground up—ensuring your web or mobile application is fast, scalable, and built specifically for you.
            </p>
             <a href="#contact" onClick={handleSmoothScroll} className="text-cyan-400 font-bold text-lg hover:text-cyan-300 transition-colors duration-300">
              Let's build something unique &rarr;
            </a>
          </div>
          <div className="order-1 md:order-2">
            <img 
              src="https://picsum.photos/seed/montford-tech/800/600" 
              alt="Scott Montford - Montford Digital" 
              className="rounded-lg shadow-2xl transform hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;