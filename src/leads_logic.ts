import { emitEvent } from './events';
import { runAutomations } from './automation';
import { persistContact, findContact, deleteContact } from './contacts_repo';
import { persistOpportunity, getOpportunitiesByContact } from './opportunities_repo';
import { Contact, Opportunity, ApiRequest } from './types';

import { normalizePhone, normalizeEmail, normalizeName } from './utils/normalization';


/**
 * Reusable Lead Creation Engine (End-to-End Pipeline)
 */
export async function createLead(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  service_type?: string;
  message?: string;
  source?: string;
}, request?: ApiRequest) {
  const user_id = request?.user?.id || 'system';
  const timestamp = new Date().toISOString();
  const phoneNorm = normalizePhone(data.phone || '');
  const emailNorm = normalizeEmail(data.email);
  const normalizedName = normalizeName(data.name);

  if (!normalizedName) {
    throw new Error('Name is required for lead creation.');
  }

  // 1. Check for Existing Contact (Duplicate Protection - Persistently)
  const contactRes = await findContact(phoneNorm.normalized, emailNorm, request?.user);
  if (!contactRes.success) {
      throw new Error(`DB_SEARCH_ERROR: ${contactRes.error}`);
  }
  const existingContact = contactRes.data;

  let contactIdToUseValue: string;
  let isNewContact = false;

  if (existingContact) {
    contactIdToUseValue = existingContact.id;
    console.log(`Duplicate lead found: using existing contact ${contactIdToUseValue}.`);
    
    // BASIC PROTECTION: Skip new opportunity if one was created for this contact in the last 2 minutes
    const oppsRes = await getOpportunitiesByContact(contactIdToUseValue, request?.user);
    if (oppsRes.success && oppsRes.data) {
        const recentOpp = oppsRes.data.find(opp => 
          (new Date().getTime() - new Date(opp.created_at).getTime()) < 120000
        );
        
        if (recentOpp) {
          throw new Error(`Duplicate submission window open for contact ${contactIdToUseValue}.`);
        }
    }
  } else {
    contactIdToUseValue = `c-${Date.now()}`;
    isNewContact = true;
    const newContact: Contact = {
      id: contactIdToUseValue,
      user_id: user_id,
      name: normalizedName,
      phone: phoneNorm.normalized, 
      email: emailNorm, 
      address: data.address || 'Lead API Submission',
      tags: ['web-lead'],
      source: data.source || 'api', 
      service: data.service_type || undefined,
      status: 'lead', 
      created_at: timestamp,
      invalid_phone: phoneNorm.invalid
    };

    // Save to DB
    const saveContactRes = await persistContact(newContact);
    if (!saveContactRes.success) {
        throw new Error(`DB_SAVE_CONTACT_ERROR: ${saveContactRes.error}`);
    }
  }


  // 2. Create Opportunity
  const newOpportunity: Opportunity = {
    id: `opp-${Date.now()}`,
    user_id: existingContact ? (existingContact.user_id || 'system') : user_id,
    contact_id: contactIdToUseValue,
    pipeline_stage: 'New Lead',
    value: 0,
    assigned_to: 'Unassigned',
    status: 'open',
    notes: `Service Type: ${data.service_type || 'N/A'}\nAddress: ${data.address || 'N/A'}\nMessage: ${data.message || 'N/A'}`,
    source: data.source || 'api',
    created_at: timestamp
  };

  // Save to DB with Transaction-Like Rollback
  const saveOppRes = await persistOpportunity(newOpportunity);
  if (!saveOppRes.success) {
      if (isNewContact) {
          console.warn(`[ROLLBACK] Opportunity failed. Deleting orphaned contact ${contactIdToUseValue}...`);
          await deleteContact(contactIdToUseValue, request?.user);
      }
      throw new Error(`DB_SAVE_OPPORTUNITY_ERROR: ${saveOppRes.error}`);
  }

  const contactIdToUse = contactIdToUseValue;


  // 3. Emit Events
  // Simulating atomic emissions
  const emissionsInThisCycle = new Set<string>();
  const guardedEmit = (name: string, payload: any) => {
    if (!emissionsInThisCycle.has(name)) {
      emitEvent(name, payload);
      emissionsInThisCycle.add(name);
    }
  };

  guardedEmit('lead_created', {
    contact_id: contactIdToUse,
    opportunity_id: newOpportunity.id,
    phone: phoneNorm.normalized,
    email: emailNorm,
    pipeline_stage: 'New Lead',
    source: data.source || 'api'
  });

  // 4. Trigger Automations
  runAutomations('OPPORTUNITY_CREATED', newOpportunity);

  return {
    contactId: contactIdToUse,
    opportunityId: newOpportunity.id,
    status: 'success'
  };
}
