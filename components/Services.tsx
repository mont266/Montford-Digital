import React from 'react';

interface ServiceCardProps {
  // Fix: Changed JSX.Element to React.JSX.Element to resolve "Cannot find namespace 'JSX'" error.
  icon: React.JSX.Element;
  title: string;
  description: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ icon, title, description }) => (
  <div className="bg-slate-800 p-8 rounded-lg shadow-lg transform hover:-translate-y-2 transition-transform duration-300">
    <div className="text-cyan-400 mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-400">{description}</p>
  </div>
);

const Services: React.FC = () => {
  const services = [
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m-9-5.747h18" /></svg>,
      title: 'UI/UX Design',
      description: 'Crafting intuitive and beautiful user interfaces that provide an exceptional user experience.',
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
      title: 'Frontend Development',
      description: 'Building responsive, high-performance websites using modern technologies like React and TypeScript.',
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      title: 'SEO Optimization',
      description: 'Improving your site’s visibility on search engines to attract more organic traffic and potential customers.',
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
      title: 'E-commerce Solutions',
      description: 'Developing robust e-commerce platforms that are secure, scalable, and easy to manage.',
    },
  ];

  return (
    <section id="services" className="py-20 sm:py-32 bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Our Services</h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">From concept to launch, we provide the complete package for your digital needs.</p>
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