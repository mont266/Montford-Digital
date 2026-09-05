// Use Deno's native server which is incredibly fast for cold starts
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // 1. Handle CORS preflight requests IMMEDIATELY
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // 2. Trello Webhook Verification IMMEDIATELY (HEAD or GET)
  // Trello sends a HEAD request to verify the URL before creating the webhook.
  if (req.method === 'HEAD' || req.method === 'GET') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Handle actual webhook data
  try {
    // Dynamic import to prevent cold-start delays during Trello verification
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
    const body = await req.json();
    
    // Internal API call from frontend (Portal -> Trello)
    if (body && body.action === 'move-card' && body.cardId) {
      if (!trelloKey || !trelloToken) {
        return new Response(JSON.stringify({ error: 'Trello API credentials missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const { cardId, isCompleted } = body;
      
      // Determine the list to move the card to (Done vs Todo)
      const targetListId = isCompleted ? trelloDoneListId : trelloTodoListId;
      
      if (!targetListId) {
        return new Response(JSON.stringify({ error: 'Trello target list ID not configured in environment (TRELLO_DONE_LIST_ID or TRELLO_TODO_LIST_ID)' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Call Trello API to move the card
      const response = await fetch(`https://api.trello.com/1/cards/${cardId}?idList=${targetListId}&key=${trelloKey}&token=${trelloToken}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error moving Trello card:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to move Trello card' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Trello Webhook Payload
    if (body && body.action) {
      const action = body.action;

      // 1. A label was added to a card (Trigger to create Todo)
      if (action.type === 'addLabelToCard') {
        const labelId = action.data.label.id;
        const cardId = action.data.card.id;
        const cardName = action.data.card.name;

        // Find if we have a project matching this Trello label ID
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('trello_label_id', labelId)
          .single();

        if (project) {
          // Check if a todo with this card ID already exists to prevent duplicates
          const { data: existingTodo } = await supabase
            .from('project_todos')
            .select('id')
            .eq('trello_card_id', cardId)
            .single();
            
          if (!existingTodo) {
            await supabase.from('project_todos').insert({
              project_id: project.id,
              description: cardName,
              is_completed: false,
              trello_card_id: cardId
            });
          }
        }
      }

      // 2. A card was moved to another list
      if (action.type === 'updateCard' && action.data.listAfter) {
        const cardId = action.data.card.id;
        const listName = action.data.listAfter.name.toLowerCase();
        
        const isCompleted = listName.includes('completed') || listName.includes('done');
        
        // Update the todo status in our database
        await supabase
          .from('project_todos')
          .update({ is_completed: isCompleted })
          .eq('trello_card_id', cardId);
      }
      
      // 3. A card name was changed
      if (action.type === 'updateCard' && action.data.old && action.data.old.name) {
        const cardId = action.data.card.id;
        const newName = action.data.card.name;
        
        await supabase
          .from('project_todos')
          .update({ description: newName })
          .eq('trello_card_id', cardId);
      }
      
      // 4. A card was deleted
      if (action.type === 'deleteCard') {
        const cardId = action.data.card.id;
        await supabase
          .from('project_todos')
          .delete()
          .eq('trello_card_id', cardId);
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
    
  } catch (error: any) {
    console.error('Error processing Trello webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
