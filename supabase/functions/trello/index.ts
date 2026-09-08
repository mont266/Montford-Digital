// Use Deno's native server which is incredibly fast for cold starts
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  if (req.method === 'HEAD' || req.method === 'GET') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const trelloKey = Deno.env.get('TRELLO_API_KEY');
    const trelloToken = Deno.env.get('TRELLO_TOKEN');
    const trelloDoneListId = Deno.env.get('TRELLO_DONE_LIST_ID'); 
    const trelloTodoListId = Deno.env.get('TRELLO_TODO_LIST_ID');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response('Server Error', { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }
    
    // Internal API call from frontend (Portal -> Trello)
    if (body && body.action === 'move-card' && body.cardId) {
      if (!trelloKey || !trelloToken) {
        return new Response(JSON.stringify({ error: 'Trello API credentials missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const { cardId, isCompleted } = body;
      
      const targetListId = isCompleted ? trelloDoneListId : trelloTodoListId;
      
      if (!targetListId) {
        return new Response(JSON.stringify({ error: 'Trello target list ID not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const response = await fetch(`https://api.trello.com/1/cards/${cardId}?idList=${targetListId}&key=${trelloKey}&token=${trelloToken}`, {
        method: 'PUT',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Failed to move Trello card' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Trello Webhook Payload - Robust Sync Approach
    if (body && body.action && body.action.data && body.action.data.card) {
      const action = body.action;
      const cardId = action.data.card.id;

      // Handle card deletion
      if (action.type === 'deleteCard') {
        await supabase.from('project_todos').delete().eq('trello_card_id', cardId);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // For all other actions (create, update, label changes), fetch the absolute latest state from Trello
      if (trelloKey && trelloToken) {
        const cardRes = await fetch(`https://api.trello.com/1/cards/${cardId}?key=${trelloKey}&token=${trelloToken}`);
        
        if (cardRes.ok) {
          const cardData = await cardRes.json();
          const cardLabels = cardData.idLabels || [];
          const cardName = cardData.name;
          const cardListId = cardData.idList;

          // Check if it's completed based on the list it's currently in
          let isCompleted = false;
          if (trelloDoneListId && cardListId === trelloDoneListId) {
             isCompleted = true;
          } else {
             // Fallback: Check list name if ID doesn't match or isn't set
             const listRes = await fetch(`https://api.trello.com/1/lists/${cardListId}?key=${trelloKey}&token=${trelloToken}`);
             if (listRes.ok) {
               const listData = await listRes.json();
               const listName = listData.name.toLowerCase();
               isCompleted = listName.includes('completed') || listName.includes('done');
             }
          }

          if (cardLabels.length > 0) {
            // Find any projects that match these labels
            const { data: projects } = await supabase
              .from('projects')
              .select('id, trello_label_id')
              .in('trello_label_id', cardLabels);

            if (projects && projects.length > 0) {
              for (const project of projects) {
                // Upsert the Todo
                const { data: existingTodo } = await supabase
                  .from('project_todos')
                  .select('id')
                  .eq('trello_card_id', cardId)
                  .eq('project_id', project.id)
                  .single();

                if (existingTodo) {
                  await supabase.from('project_todos').update({
                    description: cardName,
                    is_completed: isCompleted
                  }).eq('id', existingTodo.id);
                } else {
                  await supabase.from('project_todos').insert({
                    project_id: project.id,
                    description: cardName,
                    is_completed: isCompleted,
                    trello_card_id: cardId
                  });
                }
              }
            } else {
               // Card has labels, but none belong to our tracked projects
               await supabase.from('project_todos').delete().eq('trello_card_id', cardId);
            }
          } else {
            // Card has no labels, ensure it's not in the database
            await supabase.from('project_todos').delete().eq('trello_card_id', cardId);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
  } catch (error: any) {
    console.error('Error processing Trello webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
