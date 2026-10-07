import { supabase } from './supabaseClient';
import { Estimate, saveEstimate } from './estimates';

export interface CreateInvoiceFromEstimateParams {
  estimate: Estimate;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  projectId?: string;
  newProjectName?: string;
  entityId?: string;
  invoiceNumber?: string;
  exactAmount: number;
  issueDate: string;
  dueDate: string;
  isSplitInvoice: boolean;
  dueDatePart2?: string;
  status: 'draft' | 'sent';
  items: Array<{ description: string; quantity: number; unit_price: number }>;
}

export interface CreateInvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}

export const generateNextInvoiceNumber = async (): Promise<string> => {
  try {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      let maxNum = 0;
      for (const row of data) {
        // Match numbers like MD-005 or MD-005-A or INV-123
        const match = row.invoice_number?.match(/(?:MD|INV)-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      if (maxNum > 0) {
        return `MD-${String(maxNum + 1).padStart(3, '0')}`;
      }
    }
  } catch (e) {
    console.warn('Error fetching recent invoices for number generation:', e);
  }

  // Fallback random/timestamp based number
  return `MD-${String(Math.floor(100 + Math.random() * 900))}`;
};

export const createInvoiceFromEstimate = async (
  params: CreateInvoiceFromEstimateParams
): Promise<CreateInvoiceResult> => {
  try {
    let targetProjectId = params.projectId;
    const defaultEntityId = params.entityId || '32410dc1-309a-4ac1-9266-664620af6b47'; // Montford Digital default

    // 1. Create a project if needed or requested
    const isValidUuid = (str?: string | null): boolean => {
      if (!str) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    if (!targetProjectId && params.newProjectName) {
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: params.newProjectName,
          client_name: params.clientName,
          client_email: params.clientEmail || '',
          client_id: isValidUuid(params.clientId) ? params.clientId : null,
          entity_id: defaultEntityId,
          status: 'In development',
        })
        .select()
        .single();

      if (projectError || !newProject) {
        console.error('Error creating project for invoice:', projectError);
        return {
          success: false,
          error: projectError?.message || 'Failed to create new project for this client.',
        };
      }
      targetProjectId = newProject.id;
    }

    if (!targetProjectId) {
      return {
        success: false,
        error: 'A project is required to create an invoice. Please select an existing project or enter a new project name.',
      };
    }

    // 2. Determine invoice number
    const finalInvoiceNumber = params.invoiceNumber || (await generateNextInvoiceNumber());

    // 3. Insert Invoice and Invoice Items
    if (params.isSplitInvoice) {
      const splitGroupId = crypto.randomUUID();
      const splitAmount = params.exactAmount / 2;

      // Part 1
      const invoiceData1 = {
        project_id: targetProjectId,
        invoice_number: `${finalInvoiceNumber}-A`,
        issue_date: params.issueDate,
        due_date: params.dueDate,
        status: params.status,
        amount: splitAmount,
        entity_id: defaultEntityId,
        split_group_id: splitGroupId,
        split_part: 1,
      };

      const { data: newInvoice1, error: invoiceError1 } = await supabase
        .from('invoices')
        .insert(invoiceData1)
        .select()
        .single();

      if (invoiceError1 || !newInvoice1) {
        return {
          success: false,
          error: invoiceError1?.message || 'Failed to create split invoice part 1.',
        };
      }

      // Part 2
      const invoiceData2 = {
        project_id: targetProjectId,
        invoice_number: `${finalInvoiceNumber}-B`,
        issue_date: params.issueDate,
        due_date: params.dueDatePart2 || params.dueDate,
        status: params.status,
        amount: splitAmount,
        entity_id: defaultEntityId,
        split_group_id: splitGroupId,
        split_part: 2,
      };

      const { data: newInvoice2, error: invoiceError2 } = await supabase
        .from('invoices')
        .insert(invoiceData2)
        .select()
        .single();

      if (invoiceError2 || !newInvoice2) {
        await supabase.from('invoices').delete().eq('id', newInvoice1.id);
        return {
          success: false,
          error: invoiceError2?.message || 'Failed to create split invoice part 2.',
        };
      }

      // Line items for Part 1 and Part 2 (halved)
      const itemsPart1 = params.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price / 2,
        invoice_id: newInvoice1.id,
      }));

      const itemsPart2 = params.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price / 2,
        invoice_id: newInvoice2.id,
      }));

      await supabase.from('invoice_items').insert(itemsPart1);
      await supabase.from('invoice_items').insert(itemsPart2);

      // 4. Update the estimate status and link
      const updatedEstimate: Estimate = {
        ...params.estimate,
        status: 'invoiced',
        quoted_amount: params.exactAmount,
        invoice_id: newInvoice1.id,
        invoice_number: `${finalInvoiceNumber}-A & -B`,
      };
      await saveEstimate(updatedEstimate);

      return {
        success: true,
        invoiceId: newInvoice1.id,
        invoiceNumber: `${finalInvoiceNumber}-A & -B`,
      };
    } else {
      // Single Invoice
      const invoiceData = {
        project_id: targetProjectId,
        invoice_number: finalInvoiceNumber,
        issue_date: params.issueDate,
        due_date: params.dueDate,
        status: params.status,
        amount: params.exactAmount,
        entity_id: defaultEntityId,
      };

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError || !newInvoice) {
        return {
          success: false,
          error: invoiceError?.message || 'Failed to create invoice.',
        };
      }

      const itemsToInsert = params.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        invoice_id: newInvoice.id,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) {
        console.warn('Notice inserting invoice items:', itemsError.message);
      }

      // 4. Update the estimate status and link
      const updatedEstimate: Estimate = {
        ...params.estimate,
        status: 'invoiced',
        quoted_amount: params.exactAmount,
        invoice_id: newInvoice.id,
        invoice_number: finalInvoiceNumber,
      };
      await saveEstimate(updatedEstimate);

      return {
        success: true,
        invoiceId: newInvoice.id,
        invoiceNumber: finalInvoiceNumber,
      };
    }
  } catch (err: any) {
    console.error('Error in createInvoiceFromEstimate:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while creating invoice.',
    };
  }
};
