
import React, { useState } from 'react';
import PortfolioModal from './PortfolioModal';

// Expanded project interface for more detailed information
interface Project {
  imageSrc: string;
  title: string;
  category: string;
  description: string;
  detailedDescription: string;
  tags: string[];
  links?: {
    webapp?: string;
    android?: string;
    ios?: string;
  };
  isPlaceholder?: boolean;
}

// Data is now hardcoded in the component for easy manual updates.
const projects: Project[] = [
  {
    "imageSrc": "https://picsum.photos/seed/stoutly/600/400",
    "title": "Stoutly",
    "category": "Web & Android App",
    "description": "A comprehensive platform with both a web app and native Android app.",
    "detailedDescription": "Stoutly is a personal passion project built from the ground up. It is a dedicated social network for Guinness enthusiasts, allowing users to rate pints of Guinness around the world. The platform fosters community engagement by letting users comment on ratings and share their experiences. A key feature is the location-based discovery engine, enabling users to instantly find the best and cheapest pints of Guinness nearby, no matter where they are in the world.",
    "tags": [
      "Social Network",
      "Location Based",
      "Community"
    ],
    "links": {
      "webapp": "https://www.stoutly.co.uk",
      "android": "#"
    }
  },
  {
    imageSrc: "https://picsum.photos/seed/future-project-1/600/400",
    title: "Coming Soon",
    category: "Future Project",
    description: "We're working on something amazing. Stay tuned!",
    detailedDescription: "",
    tags: [],
    isPlaceholder: true,
  },
  {
    imageSrc: "https://picsum.photos/seed/future-project-2/600/400",
    title: "Coming Soon",
    category: "Future Project",
    description: "We're working on something amazing. Stay tuned!",
    detailedDescription: "",
    tags: [],
    isPlaceholder: true,
  },
  {
    imageSrc: "https://picsum.photos/seed/future-project-3/600/400",
    title: "Coming Soon",
    category: "Future Project",
    description: "We're working on something amazing. Stay tuned!",
    detailedDescription: "",
    tags: [],
    isPlaceholder: true,
  },
  {
    imageSrc: "https://picsum.photos/seed/future-project-4/600/400",
    title: "Coming Soon",
    category: "Future Project",
    description: "We're working on something amazing. Stay tuned!",
    detailedDescription: "",
    tags: [],
    isPlaceholder: true,
  },
  {
    imageSrc: "https://picsum.photos/seed/future-project-5/600/400",
    title: "Coming Soon",
    category: "Future Project",
    description: "We're working on something amazing. Stay tuned!",
    detailedDescription: "",
    tags: [],
    isPlaceholder: true,
  }
];


interface PortfolioItemProps {
  project: Project;
  onSelect: () => void;
}

const PortfolioItem: React.FC<PortfolioItemProps> = ({ project, onSelect }) => {
  if (project.isPlaceholder) {
    return (
      <div className="group relative overflow-hidden rounded-lg shadow-lg cursor-not-allowed">
        <img src={project.imageSrc} alt={project.title} className="w-full h-full object-cover filter grayscale" />
        <div className="absolute inset-0 bg-slate-900 bg-opacity-70 flex flex-col justify-center items-center p-6 text-center">
          <h3 className="text-2xl font-bold text-white">{project.title}</h3>
          <p className="text-cyan-400 font-semibold mt-1">{project.category}</p>
          <p className="text-slate-300 mt-2 text-sm">{project.description}</p>
        </div>
      </div>
    );
  }
  
  return (
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
};

const Portfolio: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <>
      <section id="portfolio" className="py-20 sm:py-32 bg-slate-900/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Our Work</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">We take pride in our work. Here are some of our recent projects.</p>
            <div className="w-24 h-1 bg-cyan-400 mt-4 mx-auto"></div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <PortfolioItem 
                key={index} 
                project={project}
                onSelect={() => setSelectedProject(project)} 
              />
            ))}
          </div>
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
