
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
    "imageSrc": "https://picsum.photos/seed/flow-commerce/600/400",
    "title": "Flow Commerce",
    "category": "E-commerce Platform",
    "description": "An intuitive e-commerce site with seamless checkout.",
    "detailedDescription": "For Flow Commerce, we built a custom e-commerce solution from the ground up. The platform supports thousands of products, features a streamlined multi-step checkout process, and integrates with major payment gateways. Advanced features include personalized recommendations and a powerful admin dashboard for inventory management.",
    "tags": [
      "E-commerce",
      "Retail",
      "Inventory Management"
    ],
    "links": {
      "webapp": "https://example.com"
    }
  },
  {
    "imageSrc": "https://picsum.photos/seed/artisan-cafe/600/400",
    "title": "Artisan Cafe",
    "category": "Local Business Site",
    "description": "A charming website showcasing a local cafe's menu and story.",
    "detailedDescription": "We helped Artisan Cafe brew up a new online presence. The website features a warm, inviting design that reflects their brand, a dynamic menu that's easy to update, and an integrated online ordering system that helped increase their takeaway sales by 40%.",
    "tags": [
      "Hospitality",
      "Local Business",
      "Online Ordering"
    ],
    "links": {
      "webapp": "https://example.com"
    }
  },
  {
    "imageSrc": "https://picsum.photos/seed/connect-app/600/400",
    "title": "ConnectApp",
    "category": "iOS & Android App",
    "description": "A vibrant social app to connect with like-minded people.",
    "detailedDescription": "ConnectApp is a social networking platform designed to connect people with shared interests and hobbies. We developed native iOS and Android applications with a focus on a fluid user interface, real-time chat, and an intelligent recommendation engine. The launch was supported by a high-converting landing page.",
    "tags": [
      "Social Media",
      "Real-time Chat",
      "Mobile App"
    ],
    "links": {
      "webapp": "#",
      "ios": "#",
      "android": "#"
    }
  },
  {
    "imageSrc": "https://picsum.photos/seed/data-visualize/600/400",
    "title": "DataVisualize",
    "category": "Data Dashboard",
    "description": "An interactive dashboard for complex data analysis.",
    "detailedDescription": "DataVisualize provides a powerful B2B service for data analysis. We built a highly interactive and performant dashboard application that allows users to connect various data sources, create custom visualizations, and generate insightful reports in real-time.",
    "tags": [
      "SaaS",
      "Analytics",
      "B2B"
    ]
  },
  {
    "imageSrc": "https://picsum.photos/seed/nomad-blog/600/400",
    "title": "Nomad Blog",
    "category": "Personal Blog",
    "description": "A clean and fast blog platform for a travel writer.",
    "detailedDescription": "We created a lightning-fast, SEO-optimized blog for a renowned travel writer. The site is built on a modern Jamstack architecture, ensuring excellent performance and security. It features a clean, reader-focused design, an easy-to-use CMS for publishing content, and an interactive map to document their travels.",
    "tags": [
      "Blog",
      "Travel",
      "Content Platform"
    ],
    "links": {
      "webapp": "https://example.com"
    }
  }
];


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
