import { emitEvent } from './events';
import { runAutomations } from './automation';
import { persistContact, findContact } from './contacts_repo';
import { persistOpportunity, getOpportunitiesByContact } from './opportunities_repo';
import { Contact, Opportunity, ApiRequest } from './types';

export function normalizePhone(phone: string): { normalized: string; invalid: boolean } {
  if (!phone) return { normalized: '', invalid: true };
  
  const cleaned = phone.replace(/[\s\-\(\)\[\]\{\}\.\,\/]/g, '').replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return { normalized: `+1${cleaned}`, invalid: false };
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return { normalized: `+${cleaned}`, invalid: false };
  }
  
  return { normalized: cleaned || phone, invalid: true };
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return null;
  return email.trim().toLowerCase();
}

export function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s\s+/g, ' ');
}

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
  const existingContact = findContact(phoneNorm.normalized, emailNorm, request?.user);

  let contactIdToUse: string;

  if (existingContact) {
    contactIdToUse = existingContact.id;
    console.log(`Duplicate lead found: using existing contact ${contactIdToUse}.`);
    
    // BASIC PROTECTION: Skip new opportunity if one was created for this contact in the last 2 minutes
    const contactOpps = getOpportunitiesByContact(contactIdToUse, request?.user);
    const recentOpp = contactOpps.find(opp => 
      (new Date().getTime() - new Date(opp.created_at).getTime()) < 120000
    );
    
    if (recentOpp) {
      throw new Error(`Duplicate submission window open for contact ${contactIdToUse}.`);
    }
  } else {
    contactIdToUse = `c-${Date.now()}`;
    const newContact: Contact = {
      id: contactIdToUse,
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
    persistContact(newContact);
  }

  // 2. Create Opportunity
  const newOpportunity: Opportunity = {
    id: `opp-${Date.now()}`,
    user_id: existingContact ? (existingContact.user_id || 'system') : user_id,
    contact_id: contactIdToUse,
    pipeline_stage: 'New Lead',
    value: 0,
    assigned_to: 'Unassigned',
    status: 'open',
    notes: `Service Type: ${data.service_type || 'N/A'}\nAddress: ${data.address || 'N/A'}\nMessage: ${data.message || 'N/A'}`,
    source: data.source || 'api',
    created_at: timestamp
  };

  // Save to DB
  persistOpportunity(newOpportunity);

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
