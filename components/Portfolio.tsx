import React, { useState } from 'react';
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

// Data is now hardcoded in the component for easy manual updates.
const projects: Project[] = [
  {
    "imageSrc": "/images/uploads/stoutly.jpg",
    "title": "Stoutly",
    "category": "Web & Android App",
    "description": "A comprehensive platform with both a web app and native Android app.",
    "detailedDescription": "Stoutly required a robust, dual-platform solution to serve their users both on the web and on the go. We developed a high-performance web application and a feature-rich native Android app, both powered by a unified backend. This ensures a seamless user experience, consistent data, and broad accessibility across devices.",
    "technologies": [
      "React",
      "Next.js",
      "TypeScript",
      "PostgreSQL",
      "Kotlin",
      "Jetpack Compose"
    ],
    "tags": [
      "Web App",
      "Android App"
    ],
    "links": {
      "webapp": "https://www.stoutly.co.uk",
      "android": "#"
    }
  },
  {
    "imageSrc": "/images/uploads/flow-commerce.jpg",
    "title": "Flow Commerce",
    "category": "E-commerce Platform",
    "description": "An intuitive e-commerce site with seamless checkout.",
    "detailedDescription": "For Flow Commerce, we built a custom e-commerce solution from the ground up. The platform supports thousands of products, features a streamlined multi-step checkout process, and integrates with major payment gateways. Advanced features include personalized recommendations and a powerful admin dashboard for inventory management.",
    "technologies": [
      "Shopify Plus",
      "React",
      "GraphQL",
      "Node.js",
      "Styled Components"
    ],
    "tags": [
      "Web App"
    ],
    "links": {
      "webapp": "https://example.com"
    }
  },
  {
    "imageSrc": "/images/uploads/artisan-cafe.jpg",
    "title": "Artisan Cafe",
    "category": "Local Business Site",
    "description": "A charming website showcasing a local cafe's menu and story.",
    "detailedDescription": "We helped Artisan Cafe brew up a new online presence. The website features a warm, inviting design that reflects their brand, a dynamic menu that's easy to update, and an integrated online ordering system that helped increase their takeaway sales by 40%.",
    "technologies": [
      "Gatsby",
      "Contentful",
      "Netlify",
      "Snipcart",
      "GSAP"
    ],
    "tags": [
      "Web App"
    ],
    "links": {
      "webapp": "https://example.com"
    }
  },
  {
    "imageSrc": "/images/uploads/connect-app.jpg",
    "title": "ConnectApp",
    "category": "iOS & Android App",
    "description": "A vibrant social app to connect with like-minded people.",
    "detailedDescription": "ConnectApp is a social networking platform designed to connect people with shared interests and hobbies. We developed native iOS and Android applications with a focus on a fluid user interface, real-time chat, and an intelligent recommendation engine. The launch was supported by a high-converting landing page.",
    "technologies": [
      "SwiftUI",
      "Kotlin",
      "Firebase",
      "Node.js",
      "React"
    ],
    "tags": [
      "iOS App",
      "Android App",
      "Web App"
    ],
    "links": {
      "webapp": "#",
      "ios": "#",
      "android": "#"
    }
  },
  {
    "imageSrc": "/images/uploads/data-visualize.jpg",
    "title": "DataVisualize",
    "category": "Data Dashboard",
    "description": "An interactive dashboard for complex data analysis.",
    "detailedDescription": "DataVisualize provides a powerful B2B service for data analysis. We built a highly interactive and performant dashboard application that allows users to connect various data sources, create custom visualizations, and generate insightful reports in real-time.",
    "technologies": [
      "React",
      "D3.js",
      "TypeScript",
      "Redux",
      "AWS"
    ],
    "tags": [
      "Web App"
    ]
  },
  {
    "imageSrc": "/images/uploads/nomad-blog.jpg",
    "title": "Nomad Blog",
    "category": "Personal Blog",
    "description": "A clean and fast blog platform for a travel writer.",
    "detailedDescription": "We created a lightning-fast, SEO-optimized blog for a renowned travel writer. The site is built on a modern Jamstack architecture, ensuring excellent performance and security. It features a clean, reader-focused design, an easy-to-use CMS for publishing content, and an interactive map to document their travels.",
    "technologies": [
      "Next.js",
      "Markdown",
      "Prismic",
      "Tailwind CSS",
      "Vercel"
    ],
    "tags": [
      "Web App"
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