
import React, { useEffect, useState } from 'react';

// Re-use or import the Project interface
interface Project {
  imageSrc: string;
  title: string;
  category: string;
  detailedDescription: string;
  tags: string[];
  links?: {
    webapp?: string;
    android?: string;
    ios?: string;
  };
}

interface PortfolioModalProps {
  project: Project;
  onClose: () => void;
}

const PortfolioModal: React.FC<PortfolioModalProps> = ({ project, onClose }) => {
    const [isShowing, setIsShowing] = useState(false);

    useEffect(() => {
        // Trigger the transition after the component mounts
        setIsShowing(true);
        // Prevent background scroll
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleClose = () => {
        setIsShowing(false);
        // Wait for the transition to finish before calling the parent's onClose
        setTimeout(onClose, 300); // duration should match transition duration
    }

    return (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-80 backdrop-blur-sm transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className={`bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 ${isShowing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative">
                    {/* Request a higher resolution image for the modal view */}
                    <img src={project.imageSrc.replace('/600/400', '/1024/600')} alt={project.title} className="w-full h-56 sm:h-72 object-cover rounded-t-lg" />
                     <button onClick={handleClose} className="absolute top-4 right-4 text-white bg-slate-900/50 rounded-full p-2 hover:bg-slate-900/80 transition-colors" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 sm:p-8">
                    <h2 className="text-3xl font-bold text-white mb-2">{project.title}</h2>
                    <p className="text-cyan-400 font-semibold mb-4">{project.category}</p>
                    <p className="text-slate-300 mb-6">{project.detailedDescription}</p>
                    
                    <h3 className="text-xl font-semibold text-white mb-3">Key Features & Type</h3>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {project.tags.map(tag => (
                            <span key={tag} className="bg-slate-900 text-cyan-300 text-sm font-medium px-3 py-1 rounded-full border border-slate-700">{tag}</span>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-4 items-center mt-8">
                        {project.links?.webapp && (
                            <a 
                                href={project.links.webapp} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-full text-base transition-all duration-300 transform hover:scale-105"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" /></svg>
                                <span>Visit Web App</span>
                            </a>
                        )}
                        {project.links?.android && (
                            <a 
                                href={project.links.android} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-full text-base transition-all duration-300 transform hover:scale-105"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" clipRule="evenodd" /></svg>
                                <span>Google Play</span>
                            </a>
                        )}
                        {project.links?.ios && (
                            <a 
                                href={project.links.ios} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-full text-base transition-all duration-300 transform hover:scale-105"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                                <span>App Store</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortfolioModal;
