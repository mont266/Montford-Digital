const fs = require('fs');
const content = fs.readFileSync('pages/DashboardPage.tsx', 'utf8');

const replacement = `export interface ProjectTodo {
  id: string;
  project_id: string;
  description: string;
  is_completed: boolean;
  created_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string | null;
  created_at: string;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  description: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  project_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}

const ProjectWorkspaceModal: React.FC<{ project: Project; onClose: () => void; }> = ({ project, onClose }) => {
    const [activeTab, setActiveTab] = useState<'todos' | 'milestones' | 'activity' | 'tickets'>('todos');
    
    // Todos State
    const [todos, setTodos] = useState<ProjectTodo[]>([]);
    const [newTodoDesc, setNewTodoDesc] = useState('');
    
    // Milestones State
    const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
    const [newMilestoneDesc, setNewMilestoneDesc] = useState('');

    // Activity State
    const [activities, setActivities] = useState<ProjectActivity[]>([]);
    const [newActivityDesc, setNewActivityDesc] = useState('');

    // Tickets State
    const [tickets, setTickets] = useState<SupportTicket[]>([]);

    const [loading, setLoading] = useState(true);
    const [dbError, setDbError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'todos') {
                const { data, error } = await supabase.from('project_todos').select('*').eq('project_id', project.id).order('created_at', { ascending: true });
                if (error) throw error;
                setTodos(data || []);
            } else if (activeTab === 'milestones') {
                const { data, error } = await supabase.from('project_milestones').select('*').eq('project_id', project.id).order('created_at', { ascending: true });
                if (error) throw error;
                setMilestones(data || []);
            } else if (activeTab === 'activity') {
                const { data, error } = await supabase.from('project_activities').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
                if (error) throw error;
                setActivities(data || []);
            } else if (activeTab === 'tickets') {
                const { data, error } = await supabase.from('support_tickets').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
                if (error) throw error;
                setTickets(data || []);
            }
            setDbError(null);
        } catch (err: any) {
            console.error(err);
            if (err.code === '42P01') {
                setDbError(\`The \${activeTab} feature requires a database update. Please run the provided SQL migration in your Supabase SQL Editor.\`);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [project.id, activeTab]);

    // Handlers
    const handleAddTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodoDesc.trim()) return;
        await supabase.from('project_todos').insert([{ project_id: project.id, description: newTodoDesc.trim() }]);
        setNewTodoDesc('');
        fetchData();
    };
    const handleToggleTodo = async (todo: ProjectTodo) => {
        await supabase.from('project_todos').update({ is_completed: !todo.is_completed }).eq('id', todo.id);
        fetchData();
    };
    const handleDeleteTodo = async (id: string) => {
        await supabase.from('project_todos').delete().eq('id', id);
        fetchData();
    };

    const handleAddMilestone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMilestoneTitle.trim()) return;
        await supabase.from('project_milestones').insert([{ project_id: project.id, title: newMilestoneTitle.trim(), description: newMilestoneDesc.trim() }]);
        setNewMilestoneTitle(''); setNewMilestoneDesc('');
        fetchData();
    };
    const handleUpdateMilestoneStatus = async (id: string, status: string) => {
        await supabase.from('project_milestones').update({ status }).eq('id', id);
        fetchData();
    };
    const handleDeleteMilestone = async (id: string) => {
        await supabase.from('project_milestones').delete().eq('id', id);
        fetchData();
    };

    const handleAddActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newActivityDesc.trim()) return;
        await supabase.from('project_activities').insert([{ project_id: project.id, description: newActivityDesc.trim() }]);
        setNewActivityDesc('');
        fetchData();
    };
    const handleDeleteActivity = async (id: string) => {
        await supabase.from('project_activities').delete().eq('id', id);
        fetchData();
    };

    const handleUpdateTicketStatus = async (id: string, status: string) => {
        await supabase.from('support_tickets').update({ status }).eq('id', id);
        fetchData();
    };

    return (
        <Modal onClose={onClose} title={\`Manage Workspace: \${project.name}\`} size="lg">
            <div className="flex border-b border-slate-700 mb-4 overflow-x-auto">
                {['todos', 'milestones', 'activity', 'tickets'].map(tab => (
                    <button key={tab} className={\`px-4 py-2 capitalize font-medium whitespace-nowrap \${activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-300'}\`} onClick={() => setActiveTab(tab as any)}>
                        {tab}
                    </button>
                ))}
            </div>

            {dbError ? (
                <div className="bg-amber-900/40 border border-amber-800 text-amber-300 p-4 rounded-lg">
                    <p className="font-bold mb-2">Setup Required</p>
                    <p className="text-sm">{dbError}</p>
                </div>
            ) : (
                <div className="space-y-6 min-h-[300px]">
                    {activeTab === 'todos' && (
                        <>
                            <form onSubmit={handleAddTodo} className="flex space-x-2">
                                <input type="text" value={newTodoDesc} onChange={e => setNewTodoDesc(e.target.value)} placeholder="Add a new task..." className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500" />
                                <button type="submit" disabled={!newTodoDesc.trim() || loading} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded disabled:opacity-50 transition-colors">Add</button>
                            </form>
                            {loading ? <div className="text-slate-400">Loading...</div> : (
                                <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                    {todos.map(todo => (
                                        <li key={todo.id} className="flex justify-between items-start bg-slate-900/50 p-3 rounded border border-slate-700">
                                            <label className="flex items-start space-x-3 cursor-pointer flex-1">
                                                <div className="pt-1"><input type="checkbox" checked={todo.is_completed} onChange={() => handleToggleTodo(todo)} className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-800 border-slate-600" /></div>
                                                <span className={\`text-sm \${todo.is_completed ? 'line-through text-slate-500' : 'text-slate-300'}\`}>{todo.description}</span>
                                            </label>
                                            <button onClick={() => handleDeleteTodo(todo.id)} className="text-slate-500 hover:text-red-400 p-1 ml-2 transition-colors">&times;</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}

                    {activeTab === 'milestones' && (
                        <>
                            <form onSubmit={handleAddMilestone} className="flex flex-col space-y-2 bg-slate-900/50 p-3 rounded border border-slate-700">
                                <input type="text" value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)} placeholder="Milestone Title" className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500" />
                                <input type="text" value={newMilestoneDesc} onChange={e => setNewMilestoneDesc(e.target.value)} placeholder="Description (Optional)" className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500" />
                                <button type="submit" disabled={!newMilestoneTitle.trim() || loading} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded disabled:opacity-50 transition-colors">Add Milestone</button>
                            </form>
                            {loading ? <div className="text-slate-400">Loading...</div> : (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {milestones.map(m => (
                                        <div key={m.id} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-200">{m.title}</h4>
                                                <button onClick={() => handleDeleteMilestone(m.id)} className="text-slate-500 hover:text-red-400">&times;</button>
                                            </div>
                                            {m.description && <p className="text-sm text-slate-400 mb-2">{m.description}</p>}
                                            <select value={m.status} onChange={e => handleUpdateMilestoneStatus(m.id, e.target.value)} className="text-sm bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none">
                                                <option value="pending">Pending</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'activity' && (
                        <>
                            <form onSubmit={handleAddActivity} className="flex space-x-2">
                                <input type="text" value={newActivityDesc} onChange={e => setNewActivityDesc(e.target.value)} placeholder="Add activity log (e.g. 'Completed design phase')..." className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500" />
                                <button type="submit" disabled={!newActivityDesc.trim() || loading} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded disabled:opacity-50 transition-colors">Post</button>
                            </form>
                            {loading ? <div className="text-slate-400">Loading...</div> : (
                                <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {activities.map(act => (
                                        <li key={act.id} className="flex justify-between items-start bg-slate-900/50 p-3 rounded border border-slate-700 text-sm text-slate-300">
                                            <div>
                                                <p>{act.description}</p>
                                                <span className="text-[10px] text-slate-500">{new Date(act.created_at).toLocaleString()}</span>
                                            </div>
                                            <button onClick={() => handleDeleteActivity(act.id)} className="text-slate-500 hover:text-red-400">&times;</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}

                    {activeTab === 'tickets' && (
                        <>
                            {loading ? <div className="text-slate-400">Loading...</div> : tickets.length === 0 ? <p className="text-slate-500 italic">No support tickets</p> : (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {tickets.map(t => (
                                        <div key={t.id} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-200">{t.subject}</h4>
                                                <span className="text-[10px] text-slate-500">{new Date(t.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-400 mb-3 whitespace-pre-wrap">{t.message}</p>
                                            <select value={t.status} onChange={e => handleUpdateTicketStatus(t.id, e.target.value)} className={\`text-sm rounded px-2 py-1 focus:outline-none \${t.status === 'open' ? 'bg-amber-900/30 text-amber-400 border-amber-800' : t.status === 'in_progress' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-800' : 'bg-emerald-900/30 text-emerald-400 border-emerald-800'} border\`}>
                                                <option value="open" className="bg-slate-800 text-white">Open</option>
                                                <option value="in_progress" className="bg-slate-800 text-white">In Progress</option>
                                                <option value="resolved" className="bg-slate-800 text-white">Resolved</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </Modal>
    );
};`;

const targetStart = "export interface ProjectTodo {";
const startIndex = content.indexOf(targetStart);
// find index of "};" after "const ProjectTodosModal"
const modalDeclareIndex = content.indexOf("const ProjectTodosModal", startIndex);
let endIndex = content.indexOf("};", modalDeclareIndex) + 2;


// just to be completely safe and grab only up to what we expect
const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync('pages/DashboardPage.tsx', newContent);
