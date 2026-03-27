import { emitEvent } from './events';
import { runAutomations } from './automation';
import { persistContact, findContact, deleteContact } from './contacts_repo';
import { persistOpportunity, getOpenOpportunityByContact } from './opportunities_repo';
import { Contact, Opportunity, ApiRequest } from './types';

import { validateContactInput } from './utils/validators';

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
  funnel_id?: string;
  page_id?: string;
}, request?: ApiRequest) {
  const user_id = request?.user?.id || 'system';
  const timestamp = new Date().toISOString();

  // 🛡️ C3: Use Centralized Validation
  const validated = validateContactInput({
      name: data.name,
      phone: data.phone,
      email: data.email
  });

  const { name: normalizedName, phone: phoneNormValue, invalid_phone: isPhoneInvalid, email: emailNorm } = validated;

  // 1. Check for Existing Contact (Duplicate Protection - Persistently)
  const contactRes = await findContact(phoneNormValue, emailNorm, request?.user);
  if (!contactRes.success) {
      throw new Error(`DB_SEARCH_ERROR: ${contactRes.error}`);
  }
  const existingContact = contactRes.data;

  let contactIdToUseValue: string;

  let createdByThisRequest = false; // 🛡️ F4: Track context for rollback
  if (existingContact) {
    contactIdToUseValue = existingContact.id;
    console.log(`Duplicate lead found: using existing contact ${contactIdToUseValue}.`);
    // F1 Logic: We now handle deduplication by checking for open status below.
  } else {
    contactIdToUseValue = `c-${Date.now()}`;
    createdByThisRequest = true; // Mark as candidate for rollback
    const newContact: Contact = {
      id: contactIdToUseValue,
      user_id: user_id,
      name: normalizedName,
      phone: phoneNormValue, 
      email: emailNorm, 
      address: data.address || 'Lead API Submission',
      tags: ['web-lead'],
      source: data.source || 'api', 
      service: data.service_type || undefined,
      status: 'lead', 
      created_at: timestamp,
      invalid_phone: isPhoneInvalid
    };

    // Save to DB
    const saveContactRes = await persistContact(newContact);
    if (!saveContactRes.success) {
        if (saveContactRes.code === '23505') {
            // 🛡️ REUSE (F3): Another thread beat us to it - locate the winner.
            console.log(`[Concurrency] Contact duplicate detected for ${phoneNormValue}. Resolving to existing.`);
            const winner = await findContact(phoneNormValue, emailNorm, request?.user);
            if (winner.data) {
                contactIdToUseValue = winner.data.id;
            } else {
                throw new Error(`CONCURRENCY_ERROR: ${saveContactRes.error}`);
            }
        } else {
            throw new Error(`DB_SAVE_CONTACT_ERROR: ${saveContactRes.error}`);
        }
    }
  }

  try {
    // 2. Resolve/Create Opportunity (F1 Logic)
  let activeOpp: Opportunity | null = null;
  const openOppRes = await getOpenOpportunityByContact(contactIdToUseValue, request?.user);
  if (openOppRes.success && openOppRes.data) {
    activeOpp = openOppRes.data;
    console.log(`Active opportunity ${activeOpp.id} found for contact. Reusing instead of creating.`);
  } else {
    const funnelMetadata = `[Funnel: ${data.funnel_id || 'N/A'}] [Page: ${data.page_id || 'N/A'}]`;
    const newOpportunity: Opportunity = {
      id: `opp-${Date.now()}`,
      user_id: existingContact ? (existingContact.user_id || 'system') : user_id,
      contact_id: contactIdToUseValue,
      pipeline_stage: 'New Lead',
      value: 0,
      assigned_to: 'Unassigned',
      status: 'open',
      notes: `Service Type: ${data.service_type || 'N/A'}\nAddress: ${data.address || 'N/A'}\nMessage: ${data.message || 'N/A'}\n${funnelMetadata}`,
      source: data.source || 'api',
      created_at: timestamp
    };

    const saveOppRes = await persistOpportunity(newOpportunity);
    if (!saveOppRes.success) {
        if (saveOppRes.code === '23505') {
            // 🛡️ REUSE (F3): Another thread beat us to it - locate the open deal.
            console.log(`[Concurrency] Opportunity duplicate detected. Resolving to existing.`);
            const openWinner = await getOpenOpportunityByContact(contactIdToUseValue, request?.user);
            if (openWinner.data) {
                activeOpp = openWinner.data;
            } else {
                throw new Error(`CONCURRENCY_ERROR: ${saveOppRes.error}`);
            }
        } else {
            throw new Error(`DB_SAVE_OPPORTUNITY_ERROR: ${saveOppRes.error}`);
        }
    } else {
        activeOpp = newOpportunity;
    }
  }

  const contactIdToUse = contactIdToUseValue;
  const oppIdToUse = activeOpp.id;


  // 3. Emit Events
  // Simulating atomic emissions
  const emissionsInThisCycle = new Set<string>();
  const guardedEmit = (name: string, payload: any) => {
    if (!emissionsInThisCycle.has(name)) {
      emitEvent(name, payload, user_id);
      emissionsInThisCycle.add(name);
    }
  };

  guardedEmit('lead_created', {
    contact_id: contactIdToUse,
    opportunity_id: oppIdToUse,
    phone: phoneNormValue,
    email: emailNorm,
    pipeline_stage: 'New Lead',
    source: data.source || 'api'
  });

  // 4. Trigger Automations
  runAutomations('OPPORTUNITY_CREATED', activeOpp);

    return {
      contactId: contactIdToUse,
      opportunityId: oppIdToUse,
      status: 'success'
    };
  } catch (error: any) {
    if (createdByThisRequest) {
        console.warn(`[Rollback] Operation failed. Deleting contact ${contactIdToUseValue} created by this request.`);
        await deleteContact(contactIdToUseValue, user_id);
    }
    throw error;
  }
}
