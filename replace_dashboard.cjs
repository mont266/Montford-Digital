const fs = require('fs');
const content = fs.readFileSync('pages/ClientPortalPage.tsx', 'utf-8');

const startIndex = content.indexOf('<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">');
const endIndex = content.indexOf('{/* Subscription Payment Modal */}');

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find start or end index");
  process.exit(1);
}

const replacement = `
        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-slate-700 w-full mb-6 relative">
          <button 
            className={\`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 px-2 \${activeView === 'dashboard' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}\`}
            onClick={() => setActiveView('dashboard')}
          >
            Project Dashboard
          </button>
          <button 
            className={\`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 px-2 \${activeView === 'invoices' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}\`}
            onClick={() => setActiveView('invoices')}
          >
            Invoices
            {outstandingInvoices.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{outstandingInvoices.length}</span>}
          </button>
        </div>

        {activeView === 'invoices' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 md:p-6 shadow-lg animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-white mb-6">All Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-slate-400 text-sm italic">No invoices found.</p>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                  {invoices.map(invoice => (
                    <div key={invoice.id} className="bg-slate-900/50 rounded-lg border border-slate-700 p-4 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Invoice</p>
                          <p className="text-white font-bold">{invoice.invoice_number}</p>
                        </div>
                        <span className={\`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border \${
                          invoice.status === 'paid' ? 'bg-green-900/30 text-green-400 border-green-800/50' :
                          invoice.status === 'overdue' ? 'bg-red-900/30 text-red-400 border-red-800/50' :
                          'bg-yellow-900/30 text-yellow-400 border-yellow-800/50'
                        }\`}>
                          {invoice.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Project</p>
                          <p className="text-slate-300 text-sm truncate">{invoice.projects?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Date</p>
                          <p className="text-slate-300 text-sm">{new Date(invoice.issue_date).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-slate-700/50">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Amount</p>
                          <p className="text-cyan-400 font-bold">{formatCurrency(invoice.amount)}</p>
                        </div>
                        <a 
                          href={\`/#/invoice/\${invoice.id}\`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold uppercase tracking-wider rounded-lg transition-colors shadow-lg shadow-cyan-900/20"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        <th className="pb-4 font-bold">Invoice</th>
                        <th className="pb-4 font-bold">Project</th>
                        <th className="pb-4 font-bold">Date</th>
                        <th className="pb-4 font-bold">Amount</th>
                        <th className="pb-4 font-bold">Status</th>
                        <th className="pb-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(invoice => (
                        <tr key={invoice.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors group">
                          <td className="py-4 text-white font-bold">{invoice.invoice_number}</td>
                          <td className="py-4 text-slate-400 text-sm">{invoice.projects?.name || 'N/A'}</td>
                          <td className="py-4 text-slate-400 text-sm">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                          <td className="py-4 text-white font-bold">{formatCurrency(invoice.amount)}</td>
                          <td className="py-4">
                            <span className={\`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border \${
                              invoice.status === 'paid' ? 'bg-green-900/30 text-green-400 border-green-800/50' :
                              invoice.status === 'overdue' ? 'bg-red-900/30 text-red-400 border-red-800/50' :
                              'bg-yellow-900/30 text-yellow-400 border-yellow-800/50'
                            }\`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <a 
                              href={\`/#/invoice/\${invoice.id}\`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-block px-4 py-1.5 bg-slate-700 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-all border border-slate-600 hover:border-cyan-500"
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeView === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {projects.length === 0 ? (
               <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
                 <p className="text-slate-400 font-medium">No active projects found.</p>
               </div>
            ) : (
              <>
                {projects.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                    {projects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setActiveProjectId(p.id)}
                        className={\`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all \${activeProjectId === p.id ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}\`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}

                {(() => {
                  const project = projects.find(p => p.id === activeProjectId) || projects[0];
                  if (!project) return null;

                  const projectMilestones = milestones[project.id] || [];
                  const completedMilestones = projectMilestones.filter(m => m.status === 'completed').length;
                  const progressPercent = projectMilestones.length > 0 ? Math.round((completedMilestones / projectMilestones.length) * 100) : 0;

                  return (
                    <div className="flex flex-col gap-6">
                      
                      {/* Project Header & Progress */}
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-700">
                          <div 
                            className="h-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] transition-all duration-1000 ease-out" 
                            style={{ width: \`\${progressPercent}%\` }}
                          ></div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mt-2 relative z-10">
                          <div>
                            <span className={\`inline-block mb-3 text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full \${
                              project.status === 'Completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                              project.status === 'Ready for review' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                              project.status === 'Cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }\`}>
                              {project.status || 'Active'}
                            </span>
                            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight">{project.name}</h2>
                          </div>

                          <div className="w-full md:w-auto flex flex-col md:items-end gap-4">
                             <div className="flex items-center gap-4 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                               <div className="flex flex-col">
                                 <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Progress</span>
                                 <span className="text-xl font-bold text-white">{progressPercent}%</span>
                               </div>
                               <div className="w-8 h-8 rounded-full bg-cyan-900/40 border border-cyan-500/30 flex items-center justify-center">
                                 <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                               </div>
                             </div>

                             {project.preview_url && (
                              <a 
                                href={project.preview_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full md:w-auto inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-all px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
                              >
                                View Live Project
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                             )}
                          </div>
                        </div>
                      </div>

                      {/* Bento Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Column 1: Task Board & Recurring Fee */}
                        <div className="space-y-6">
                           
                           {/* Recurring Fee block (moved up if exists for priority) */}
                           {project.recurring_fee && project.recurring_fee > 0 && (
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg relative overflow-hidden flex flex-col gap-4">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
                                <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {project.recurring_fee_description || 'Recurring Subscription'}
                              </div>

                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white">
                                  {project.stripe_subscription_status === 'active' && subscriptionDetails[project.id] 
                                    ? \`\${formatCurrency(subscriptionDetails[project.id].amount)}\`
                                    : \`\${formatCurrency((selectedIntervals[project.id] === 'year' ? 12 : 1) * project.recurring_fee)}\`
                                  }
                                </span>
                                <span className="text-sm text-slate-500 font-medium">/{project.stripe_subscription_status === 'active' && subscriptionDetails[project.id] ? (subscriptionDetails[project.id].interval === 'year' ? 'yr' : 'mo') : (selectedIntervals[project.id] === 'year' ? 'yr' : 'mo')}</span>
                              </div>

                              {project.stripe_subscription_status === 'active' ? (
                                <div className="mt-2 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                  <div className="flex flex-col gap-3">
                                    <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded w-fit">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active
                                    </span>
                                    {subscriptionDetails[project.id] && (
                                      <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        Next billing: <span className="text-slate-200">{new Date(subscriptionDetails[project.id].current_period_end * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleCancelSubscription(project)}
                                      disabled={isCanceling === project.id}
                                      className="mt-2 w-full py-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 border border-slate-600 hover:border-red-900/50 text-xs font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50"
                                    >
                                      {isCanceling === project.id ? 'Canceling...' : 'Cancel'}
                                    </button>
                                  </div>
                                </div>
                              ) : project.stripe_subscription_status === 'canceled' ? (
                                <div className="mt-2 flex flex-col gap-3">
                                  <span className="text-amber-500 text-[10px] uppercase tracking-wider font-bold">Canceled</span>
                                  <button
                                    onClick={() => handleSubscribeInitiate(project)}
                                    disabled={isProcessingPayment}
                                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    Resubscribe
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-2 flex flex-col gap-3">
                                  {clientSecret && activeSubscriptionId === project.id ? (
                                    <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-center">
                                      <p className="text-xs text-cyan-400 font-medium animate-pulse">Payment modal active...</p>
                                    </div>
                                  ) : (
                                    <>
                                      <select
                                        value={selectedIntervals[project.id] || 'month'}
                                        onChange={(e) => handleIntervalChange(project.id, e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500"
                                      >
                                        <option value="month">Monthly Billing</option>
                                        <option value="year">Yearly (Save 20%)</option>
                                      </select>
                                      <button
                                        onClick={() => handleSubscribeInitiate(project)}
                                        disabled={isProcessingPayment}
                                        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-cyan-900/20"
                                      >
                                        Subscribe
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                           )}

                           {/* Task Board */}
                           <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col h-[400px]">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                              Task Board
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                               {todos[project.id] && todos[project.id].length > 0 ? (
                                  todos[project.id].map(todo => (
                                    <div key={todo.id} className="flex items-start gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                                      <div className="mt-0.5 shrink-0">
                                        {todo.is_completed ? (
                                          <div className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center">
                                            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                          </div>
                                        ) : (
                                          <div className="w-5 h-5 rounded-md border-2 border-slate-600 bg-slate-800"></div>
                                        )}
                                      </div>
                                      <span className={\`text-sm \${todo.is_completed ? 'line-through text-slate-500' : 'text-slate-300'}\`}>
                                        {todo.description}
                                      </span>
                                    </div>
                                  ))
                               ) : (
                                 <p className="text-slate-500 text-sm italic text-center mt-10">No tasks mapped yet.</p>
                               )}
                            </div>
                           </div>

                        </div>

                        {/* Column 2: Milestones & Activity */}
                        <div className="space-y-6">
                          
                          {/* Milestones */}
                          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col max-h-[500px]">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Project Milestones
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                              {projectMilestones.length > 0 ? (
                                <div className="space-y-5 pl-2 py-2">
                                  {projectMilestones.map((m, idx) => (
                                    <div key={m.id} className="relative pl-6">
                                      {idx !== projectMilestones.length - 1 && (
                                        <div className="absolute left-[7px] top-6 bottom-[-24px] w-[2px] bg-slate-700"></div>
                                      )}
                                      <div className={\`absolute left-[-2px] top-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-800 \${
                                        m.status === 'completed' ? 'bg-cyan-500' : m.status === 'in_progress' ? 'bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.3)]' : 'bg-slate-600'
                                      }\`}>
                                        {m.status === 'completed' && <svg className="w-3 h-3 text-cyan-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                      </div>
                                      <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 ml-2">
                                        <div className="flex justify-between items-center mb-1 gap-2">
                                          <span className="font-bold text-slate-200 text-sm">{m.title}</span>
                                          <span className={\`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-wider whitespace-nowrap \${m.status === 'completed' ? 'text-cyan-400 bg-cyan-500/10' : m.status === 'in_progress' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 bg-slate-800'}\`}>{m.status.replace('_', ' ')}</span>
                                        </div>
                                        {m.description && <p className="text-slate-400 text-xs mt-1">{m.description}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-500 text-sm italic text-center mt-10">No milestones set.</p>
                              )}
                            </div>
                          </div>

                          {/* Activity Log */}
                          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col max-h-[350px]">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Activity Log
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                               {activities[project.id] && activities[project.id].length > 0 ? (
                                  activities[project.id].map(a => (
                                    <div key={a.id} className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50 flex flex-col gap-1.5">
                                      <span className="text-sm text-slate-200">{a.description}</span>
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    </div>
                                  ))
                               ) : (
                                 <p className="text-slate-500 text-sm italic text-center mt-6">No recent activity.</p>
                               )}
                            </div>
                          </div>

                        </div>

                        {/* Column 3: Tickets */}
                        <div className="space-y-6">
                           
                           {/* Support Tickets */}
                           <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col h-[775px]">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 pb-4 border-b border-slate-700/50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                              Support & Requests
                            </div>
                            
                            <form onSubmit={(e) => { e.preventDefault(); handleCreateTicket(project.id); }} className="space-y-3 bg-slate-900/60 p-4 flex flex-col rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden mb-6 flex-shrink-0">
                              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50"></div>
                              <p className="text-xs font-bold text-white mb-1">New Request</p>
                              <input type="text" placeholder="Subject line" value={newTicketSubjects[project.id] || ''} onChange={e => setNewTicketSubjects(prev => ({...prev, [project.id]: e.target.value}))} className="bg-slate-800 text-sm border border-slate-700 rounded-md px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all" required />
                              <textarea placeholder="How can we help?" value={newTicketMessages[project.id] || ''} onChange={e => setNewTicketMessages(prev => ({...prev, [project.id]: e.target.value}))} className="bg-slate-800 text-sm border border-slate-700 rounded-md px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 min-h-[90px] resize-y transition-all" required />
                              <button type="submit" disabled={isSubmittingTicket === project.id} className="w-full justify-center px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-md disabled:opacity-50 transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2 mt-1">
                                {isSubmittingTicket === project.id ? (
                                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Submitting...</>
                                ) : (
                                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Send Request</>
                                )}
                              </button>
                            </form>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                              {tickets[project.id] && tickets[project.id].length > 0 ? (
                                tickets[project.id].map(t => (
                                  <div key={t.id} className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/80 shadow-inner flex flex-col gap-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="font-bold text-sm text-white break-words">{t.subject}</span>
                                      <span className={\`text-[9px] px-2 py-1 rounded-sm uppercase font-bold tracking-widest whitespace-nowrap \${
                                        t.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                                        t.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                                        'bg-slate-700/50 text-slate-300 border border-slate-600'
                                      }\`}>{t.status.replace('_', ' ')}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed max-w-none">{t.message}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-500 text-sm italic text-center mt-6">No previous requests.</p>
                              )}
                            </div>

                           </div>
                        </div>

                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync('pages/ClientPortalPage.tsx', newContent, 'utf-8');
console.log('Replaced layout successfully');
