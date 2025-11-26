
import React from 'react';

interface ServiceCardProps {
  // Fix: Changed JSX.Element to React.JSX.Element to resolve "Cannot find namespace 'JSX'" error.
  icon: React.JSX.Element;
  title: string;
  description: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ icon, title, description }) => (
  <div className="bg-slate-800 p-8 rounded-lg shadow-lg transform hover:-translate-y-2 transition-transform duration-300 border border-slate-700 hover:border-cyan-500/30">
    <div className="text-cyan-400 mb-6 bg-slate-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner shadow-cyan-900/20">
      {icon}
    </div>
    <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  </div>
);

const Services: React.FC = () => {
  const services = [
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
      title: 'Bespoke Web Applications',
      description: 'We don’t use rigid templates. We engineer robust, scalable web applications from the ground up, tailored specifically to your complex business logic and performance needs.',
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
      title: 'Mobile App Development',
      description: 'Native iOS and Android solutions built for speed and engagement. Whether it’s a social network or a utility tool, we bring your product to the palm of your hand without relying on clunky cross-platform wrappers.',
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
      title: 'SaaS & E-commerce',
      description: 'Secure, high-performance platforms for your digital business. From subscription-based SaaS dashboards to custom inventory management systems, we build the backend muscle your business relies on.',
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      title: 'Product Strategy & MVPs',
      description: 'Got an exciting new idea? We partner with you to refine your concept, architect the technical foundation, and build a Minimum Viable Product (MVP) that gets you to market fast.',
    },
  ];

  return (
    <section id="services" className="py-20 sm:py-32 bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Our Expertise</h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">We specialize in building unique digital systems. Here is how we can help you.</p>
           <div className="w-24 h-1 bg-cyan-400 mt-4 mx-auto"></div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <ServiceCard key={index} {...service} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
