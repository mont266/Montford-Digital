
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
              Who We Are
            </h2>
            <div className="w-24 h-1 bg-cyan-400 mb-6"></div>
            <p className="text-lg text-slate-300 mb-4">
              Montford Digital is a passionate team of designers and developers dedicated to building elegant and effective digital solutions. We believe that a great website is a blend of artistry and engineering.
            </p>
            <p className="text-lg text-slate-300 mb-6">
              Our mission is to empower businesses by creating an online presence that not only looks stunning but also performs flawlessly. We collaborate closely with our clients to understand their vision and translate it into a digital masterpiece.
            </p>
             <a href="#contact" onClick={handleSmoothScroll} className="text-cyan-400 font-bold text-lg hover:text-cyan-300 transition-colors duration-300">
              Let's build something together &rarr;
            </a>
          </div>
          <div className="order-1 md:order-2">
            <img 
              src="https://picsum.photos/seed/montford/800/600" 
              alt="Montford Digital Team" 
              className="rounded-lg shadow-2xl transform hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
