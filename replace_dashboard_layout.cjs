const fs = require('fs');
const file = 'pages/ClientPortalPage.tsx';
let content = fs.readFileSync(file, 'utf-8');

const target1 = `{activeView === 'dashboard' && (
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
                    <div className="flex flex-col gap-6">`;

const replace1 = `{activeView === 'dashboard' && (
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-300">
            {projects.length === 0 ? (
               <div className="w-full bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
                 <p className="text-slate-400 font-medium">No active projects found.</p>
               </div>
            ) : (
              <>
                 {projects.length > 1 && (
                   <div className="w-full lg:w-64 shrink-0">
                     <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 sticky top-6">
                       <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">Your Projects</h3>
                       <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible custom-scrollbar pb-2 lg:pb-0">
                         {projects.map(p => {
                           const pMilestones = milestones[p.id] || [];
                           const completed = pMilestones.filter(m => m.status === 'completed').length;
                           const progress = pMilestones.length > 0 ? Math.round((completed / pMilestones.length) * 100) : 0;
                           
                           return (
                             <button
                               key={p.id}
                               onClick={() => setActiveProjectId(p.id)}
                               className={\`flex flex-col items-start p-3 rounded-lg text-left whitespace-nowrap lg:whitespace-normal transition-all min-w-[200px] lg:min-w-0 border \${activeProjectId === p.id ? 'bg-cyan-900/20 border-cyan-500/50 shadow-lg shadow-cyan-900/10' : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/30'}\`}
                             >
                               <span className={\`text-sm font-bold truncate w-full mb-2 \${activeProjectId === p.id ? 'text-cyan-400' : 'text-slate-300'}\`}>{p.name}</span>
                               <div className="w-full flex items-center gap-2">
                                 <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                   <div className={\`h-full \${activeProjectId === p.id ? 'bg-cyan-400' : 'bg-slate-500'}\`} style={{ width: \`\${progress}%\` }}></div>
                                 </div>
                                 <span className={\`text-[10px] font-bold \${activeProjectId === p.id ? 'text-cyan-400' : 'text-slate-500'}\`}>{progress}%</span>
                               </div>
                             </button>
                           );
                         })}
                       </div>
                     </div>
                   </div>
                 )}

                <div className="flex-1 overflow-hidden">
                  {(() => {
                    const project = projects.find(p => p.id === activeProjectId) || projects[0];
                    if (!project) return null;

                    const projectMilestones = milestones[project.id] || [];
                    const completedMilestones = projectMilestones.filter(m => m.status === 'completed').length;
                    const progressPercent = projectMilestones.length > 0 ? Math.round((completedMilestones / projectMilestones.length) * 100) : 0;

                    return (
                      <div className="flex flex-col gap-6">`;

const target2 = `                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>`;

const replace2 = `                      </div>
                    </div>
                  );
                })()}
                </div>
              </>
            )}
          </div>
        )}
      </div>`;

if (!content.includes(target1) || !content.includes(target2)) {
  console.error("Targets not found!");
  process.exit(1);
}

content = content.replace(target1, replace1).replace(target2, replace2);
fs.writeFileSync(file, content, 'utf-8');
console.log("Success");
