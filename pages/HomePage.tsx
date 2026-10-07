import React from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import About from '../components/About';
import Services from '../components/Services';
import Portfolio from '../components/Portfolio';
import QuoteForm from '../components/QuoteForm';
import Footer from '../components/Footer';

const HomePage: React.FC = () => {
  return (
    <div className="bg-slate-900 text-slate-300 font-sans leading-relaxed min-h-screen w-full overflow-x-hidden relative">
      <Header />
      <main className="w-full overflow-x-hidden">
        <Hero />
        <About />
        <Services />
        <Portfolio />
        <QuoteForm />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;