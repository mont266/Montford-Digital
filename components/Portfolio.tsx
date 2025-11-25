
import React from 'react';

interface PortfolioItemProps {
  imageSrc: string;
  title: string;
  category: string;
  description: string;
}

const PortfolioItem: React.FC<PortfolioItemProps> = ({ imageSrc, title, category, description }) => (
  <div className="group relative overflow-hidden rounded-lg shadow-lg">
    <img src={imageSrc} alt={title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
    <div className="absolute inset-0 bg-black bg-opacity-50 group-hover:bg-opacity-70 transition-all duration-300 flex flex-col justify-end p-6">
      <div className="transform translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
        <h3 className="text-2xl font-bold text-white">{title}</h3>
        <p className="text-cyan-400 font-semibold">{category}</p>
        <p className="text-slate-200 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">{description}</p>
      </div>
    </div>
  </div>
);

const Portfolio: React.FC = () => {
  const projects = [
    { imageSrc: 'https://picsum.photos/seed/project1/600/400', title: 'Zenith Corp', category: 'Corporate Website', description: 'A modern, responsive website for a leading tech corporation.' },
    { imageSrc: 'https://picsum.photos/seed/project2/600/400', title: 'Flow Commerce', category: 'E-commerce Platform', description: 'An intuitive e-commerce site with seamless checkout.' },
    { imageSrc: 'https://picsum.photos/seed/project3/600/400', title: 'Artisan Cafe', category: 'Local Business Site', description: 'A charming website showcasing a local cafe\'s menu and story.' },
    { imageSrc: 'https://picsum.photos/seed/project4/600/400', title: 'ConnectApp', category: 'Mobile App Landing Page', description: 'A vibrant landing page to drive app downloads.' },
    { imageSrc: 'https://picsum.photos/seed/project5/600/400', title: 'DataVisualize', category: 'Data Dashboard', description: 'An interactive dashboard for complex data analysis.' },
    { imageSrc: 'https://picsum.photos/seed/project6/600/400', title: 'Nomad Blog', category: 'Personal Blog', description: 'A clean and fast blog platform for a travel writer.' },
  ];

  return (
    <section id="portfolio" className="py-20 sm:py-32 bg-slate-900/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Our Work</h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">We take pride in our work. Here are some of our recent projects.</p>
          <div className="w-24 h-1 bg-cyan-400 mt-4 mx-auto"></div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <PortfolioItem key={index} {...project} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Portfolio;
