import { supabase } from './supabaseClient';
import { Estimate, saveEstimate } from './estimates';

export interface ConvertEstimateOptions {
  estimate: Estimate;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  projectId: string; // Existing project ID or 'new'
  newProjectName?: string;
  exactAmount: number;
  billingStructure: 'full' | 'deposit_50' | 'split_50_50';
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  dueDatePart2?: string;
  status: 'draft' | 'sent';
  lineItems: { description: string; quantity: number; unit_price: number }[];
}

export interface ConvertEstimateResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  secondInvoiceId?: string;
  secondInvoiceNumber?: string;
  projectId?: string;
  error?: string;
}

export const fetchNextInvoiceNumber = async (): Promise<string> => {
  try {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data && data.invoice_number) {
      const parts = data.invoice_number.split('-');
      // Check if format is MD-001 or INV-001
      if (parts.length >= 2) {
        const prefix = parts[0];
        const numPart = parseInt(parts[1], 10);
        if (!isNaN(numPart)) {
          return `${prefix}-${(numPart + 1).toString().padStart(3, '0')}`;
        }
      }
    }
  } catch (err) {
    console.warn('Could not determine next invoice number from database, using sequence fallback:', err);
  }
  return `MD-${Math.floor(100 + Math.random() * 900)}`;
};

export const fetchClientProjects = async (clientId: string) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, entity_id, client_id')
      .eq('client_id', clientId)
      .order('name');
    if (!error && data) {
      return data;
    }
  } catch (e) {
    console.warn('Error fetching client projects:', e);
  }
  return [];
};

export const getDefaultEntityId = async (): Promise<string> => {
  try {
    const { data } = await supabase
      .from('projects')
      .select('entity_id')
      .not('entity_id', 'is', null)
      .limit(1);
    if (data && data[0]?.entity_id) {
      return data[0].entity_id;
    }
  } catch (e) {
    console.warn('Error fetching default entity_id:', e);
  }
  return '32410dc1-309a-4ac1-9266-664620af6b47';
};

export const convertEstimateToInvoice = async (
  options: ConvertEstimateOptions
): Promise<ConvertEstimateResult> => {
  const {
    estimate,
    clientId,
    clientName,
    clientEmail,
    projectId,
    newProjectName,
    exactAmount,
    billingStructure,
    invoiceNumber,
    issueDate,
    dueDate,
    dueDatePart2,
    status,
    lineItems,
  } = options;

  try {
    const entityId = await getDefaultEntityId();

    // 1. Resolve or Create Project
    let finalProjectId = projectId;
    if (projectId === 'new' || !projectId) {
      const projectNameToCreate =
        newProjectName?.trim() || estimate.title || `${clientName} Project`;

      const { data: newProj, error: projError } = await supabase
        .from('projects')
        .insert({
          name: projectNameToCreate,
          client_id: clientId || null,
          client_name: clientName,
          client_email: clientEmail || '',
          entity_id: entityId,
          status: 'In development',
        })
        .select()
        .single();

      if (projError || !newProj) {
        throw new Error(
          'Failed to create project: ' + (projError?.message || 'Unknown database error')
        );
      }
      finalProjectId = newProj.id;
    }

    // 2. Insert Invoice(s)
    if (billingStructure === 'split_50_50') {
      const splitGroupId = crypto.randomUUID();
      const splitAmount = Math.round((exactAmount / 2) * 100) / 100;

      const invoiceData1 = {
        project_id: finalProjectId,
        invoice_number: `${invoiceNumber}-A`,
        issue_date: issueDate,
        due_date: dueDate,
        status,
        amount: splitAmount,
        entity_id: entityId,
        split_group_id: splitGroupId,
        split_part: 1,
      };

      const invoiceData2 = {
        project_id: finalProjectId,
        invoice_number: `${invoiceNumber}-B`,
        issue_date: issueDate,
        due_date: dueDatePart2 || dueDate,
        status: 'draft',
        amount: splitAmount,
        entity_id: entityId,
        split_group_id: splitGroupId,
        split_part: 2,
      };

      const { data: inv1, error: err1 } = await supabase
        .from('invoices')
        .insert(invoiceData1)
        .select()
        .single();
      if (err1 || !inv1) throw new Error('Failed to create part 1 invoice: ' + err1?.message);

      const { data: inv2, error: err2 } = await supabase
        .from('invoices')
        .insert(invoiceData2)
        .select()
        .single();
      if (err2 || !inv2) throw new Error('Failed to create part 2 invoice: ' + err2?.message);

      // Line items divided across both
      const itemsPart1 = lineItems.map((item) => ({
        invoice_id: inv1.id,
        description: `${item.description} (Part 1 - 50% Deposit)`,
        quantity: item.quantity,
        unit_price: Math.round((item.unit_price / 2) * 100) / 100,
      }));

      const itemsPart2 = lineItems.map((item) => ({
        invoice_id: inv2.id,
        description: `${item.description} (Part 2 - 50% Completion)`,
        quantity: item.quantity,
        unit_price: Math.round((item.unit_price / 2) * 100) / 100,
      }));

      await supabase.from('invoice_items').insert(itemsPart1);
      await supabase.from('invoice_items').insert(itemsPart2);

      // Update estimate
      await saveEstimate({
        ...estimate,
        status: 'invoiced',
        quoted_amount: exactAmount,
        invoice_id: inv1.id,
        invoice_number: `${invoiceNumber}-A & B`,
      });

      return {
        success: true,
        invoiceId: inv1.id,
        invoiceNumber: `${invoiceNumber}-A`,
        secondInvoiceId: inv2.id,
        secondInvoiceNumber: `${invoiceNumber}-B`,
        projectId: finalProjectId,
      };
    } else {
      // Full invoice or 50% Deposit invoice
      const invoiceAmount =
        billingStructure === 'deposit_50'
          ? Math.round((exactAmount / 2) * 100) / 100
          : exactAmount;

      const invoiceData = {
        project_id: finalProjectId,
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate,
        status,
        amount: invoiceAmount,
        entity_id: entityId,
      };

      const { data: newInvoice, error: invError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invError || !newInvoice) {
        throw new Error('Failed to create invoice: ' + invError?.message);
      }

      // Format items
      const itemsToInsert = lineItems.map((item) => {
        const price =
          billingStructure === 'deposit_50'
            ? Math.round((item.unit_price / 2) * 100) / 100
            : item.unit_price;
        const descSuffix = billingStructure === 'deposit_50' ? ' (50% Upfront Deposit)' : '';
        return {
          invoice_id: newInvoice.id,
          description: `${item.description}${descSuffix}`,
          quantity: item.quantity,
          unit_price: price,
        };
      });

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) {
        console.warn('Notice inserting invoice items:', itemsError.message);
      }

      // Update estimate status
      await saveEstimate({
        ...estimate,
        status: 'invoiced',
        quoted_amount: exactAmount,
        invoice_id: newInvoice.id,
        invoice_number: invoiceNumber,
      });

      return {
        success: true,
        invoiceId: newInvoice.id,
        invoiceNumber,
        projectId: finalProjectId,
      };
    }
  } catch (error: any) {
    console.error('Error in convertEstimateToInvoice:', error);
    return {
      success: false,
      error: error?.message || 'Failed to generate invoice from estimate.',
    };
  }
};
