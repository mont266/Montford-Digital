import React, { useState, useEffect } from 'react';
import PortfolioModal from './PortfolioModal';

// Expanded project interface for more detailed information
interface Project {
  imageSrc: string;
  title: string;
  category: string;
  description: string;
  detailedDescription: string;
  technologies: string[];
  tags: string[];
  links?: {
    webapp?: string;
    android?: string;
    ios?: string;
  };
}

interface PortfolioItemProps {
  project: Project;
  onSelect: () => void;
}

const PortfolioItem: React.FC<PortfolioItemProps> = ({ project, onSelect }) => (
  <div onClick={onSelect} className="group relative overflow-hidden rounded-lg shadow-lg cursor-pointer">
    <img src={project.imageSrc} alt={project.title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
    <div className="absolute inset-0 bg-black bg-opacity-50 group-hover:bg-opacity-70 transition-all duration-300 flex flex-col justify-end p-6">
      <div className="transform translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
        <h3 className="text-2xl font-bold text-white">{project.title}</h3>
        <p className="text-cyan-400 font-semibold">{project.category}</p>
        <p className="text-slate-200 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">{project.description}</p>
      </div>
    </div>
  </div>
);

const Portfolio: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/content/portfolio.json');
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio data');
        }
        const data = await response.json();
        setProjects(data.projects);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return (
    <>
      <section id="portfolio" className="py-20 sm:py-32 bg-slate-900/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Our Work</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">We take pride in our work. Here are some of our recent projects.</p>
            <div className="w-24 h-1 bg-cyan-400 mt-4 mx-auto"></div>
          </div>
          {loading && <p className="text-center text-cyan-400">Loading projects...</p>}
          {error && <p className="text-center text-red-400">Error: {error}</p>}
          {!loading && !error && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((project, index) => (
                <PortfolioItem 
                  key={index} 
                  project={project}
                  onSelect={() => setSelectedProject(project)} 
                />
              ))}
            </div>
          )}
        </div>
      </section>
      {selectedProject && (
        <PortfolioModal 
          project={selectedProject} 
          onClose={() => setSelectedProject(null)} 
        />
      )}
    </>
  );
};

export default Portfolio;