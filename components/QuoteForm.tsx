
import React, { useState } from 'react';

const QuoteForm: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    details: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you would handle form submission here (e.g., API call)
    console.log('Form data:', formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section id="contact" className="py-20 sm:py-32 bg-slate-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Thank You!</h2>
            <p className="mt-4 text-lg text-cyan-400">Your request has been sent. We'll be in touch soon.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="py-20 sm:py-32 bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Have a project in mind?</h2>
          <p className="mt-4 text-lg text-slate-400">Let's turn your idea into a reality. Fill out the form below to get started.</p>
          <div className="w-24 h-1 bg-cyan-400 mt-4 mx-auto"></div>
        </div>
        <form onSubmit={handleSubmit} className="mt-12 max-w-xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300">Full Name</label>
              <input type="text" name="name" id="name" required value={formData.name} onChange={handleChange} className="mt-1 block w-full bg-slate-800 border border-slate-700 rounded-md shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email Address</label>
              <input type="email" name="email" id="email" required value={formData.email} onChange={handleChange} className="mt-1 block w-full bg-slate-800 border border-slate-700 rounded-md shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" />
            </div>
          </div>
          <div className="mt-6">
            <label htmlFor="company" className="block text-sm font-medium text-slate-300">Company (Optional)</label>
            <input type="text" name="company" id="company" value={formData.company} onChange={handleChange} className="mt-1 block w-full bg-slate-800 border border-slate-700 rounded-md shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" />
          </div>
          <div className="mt-6">
            <label htmlFor="details" className="block text-sm font-medium text-slate-300">Project Details</label>
            <textarea id="details" name="details" rows={5} required value={formData.details} onChange={handleChange} className="mt-1 block w-full bg-slate-800 border border-slate-700 rounded-md shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"></textarea>
          </div>
          <div className="mt-8 text-center">
            <button type="submit" className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-12 rounded-full text-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-500/20">
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default QuoteForm;
