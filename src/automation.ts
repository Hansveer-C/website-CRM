import { Automation, TriggerType, Opportunity, Activity, Contact } from './types';
import { getContact } from './contacts_repo';
import { mockActivities, mockInvoices } from './db';

export function checkOverdueInvoices() {
  const now = new Date();
  mockInvoices.forEach(invoice => {
    // If unpaid and overdue
    if (invoice.status === 'unpaid' && new Date(invoice.due_date) < now) {
      // Check if a follow-up task already exists for this invoice to avoid spam
      const alreadyExists = mockActivities.some(a => 
        a.contact_id === invoice.contact_id && 
        a.description.includes(`INV-${invoice.id}`) &&
        a.description.includes('Follow up for payment')
      );

      if (!alreadyExists) {
        mockActivities.push({
          id: 'task-overdue-' + invoice.id + '-' + Math.floor(Math.random() * 1000),
          contact_id: invoice.contact_id,
          type: 'note',
          description: `Follow up for payment (INV-${invoice.id})`,
          due_date: new Date().toISOString(),
          completed: false
        });
        console.log(`[AUTOMATION: OVERDUE] Created payment follow-up for INV-${invoice.id}`);
      }
    }
  });
}

const automations: Automation[] = [
  {
    id: 'a1',
    name: 'Auto-follow task for new leads',
    trigger: 'OPPORTUNITY_CREATED',
    action: 'CREATE_TASK',
    actionParams: {
      type: 'call',
      description: 'Call new lead ASAP',
      dueInMinutes: 10
    }
  },
  {
    id: 'a2',
    name: 'Notify when job is scheduled',
    trigger: 'OPPORTUNITY_STAGE_UPDATED',
    condition: (context: Opportunity) => context.pipeline_stage === 'Scheduled',
    action: 'SEND_NOTIFICATION',
    actionParams: {
      message: '🎉 A job has been scheduled! Get ready.'
    }
  },
  {
    id: 'a3',
    name: 'Final follow up when completed',
    trigger: 'OPPORTUNITY_STAGE_UPDATED',
    condition: (context: Opportunity) => context.pipeline_stage === 'Completed',
    action: 'CREATE_TASK',
    actionParams: {
      type: 'visit',
      description: 'Site cleanup & final inspection',
      dueInDays: 0
    }
  },
  {
    id: 'a4',
    name: 'Follow up on sent quote',
    trigger: 'OPPORTUNITY_STAGE_UPDATED',
    condition: (context: Opportunity) => context.pipeline_stage === 'Quote Sent',
    action: 'CREATE_TASK',
    actionParams: {
      type: 'note',
      description: 'Follow up on quote in 24 hours',
      dueInDays: 1
    }
  }
];

export function runAutomations(trigger: TriggerType, context: any) {
  const activeAutomations = automations.filter(a => 
    a.trigger === trigger && (!a.condition || a.condition(context))
  );

  activeAutomations.forEach(automation => {
    executeAction(automation, context);
  });
}

function executeAction(automation: Automation, context: any) {
  switch (automation.action) {
    case 'CREATE_TASK':
      createTaskAction(automation.actionParams, context);
      break;
    case 'SEND_NOTIFICATION':
      sendNotificationAction(automation.actionParams, context);
      break;
  }
}

function createTaskAction(params: any, context: Opportunity) {
  const contact = getContact(context.contact_id, context.user_id);
  const contactName = contact ? contact.name : 'Unknown';
  
  const dueDate = new Date();
  if (params.dueInDays) {
    dueDate.setDate(dueDate.getDate() + params.dueInDays);
  }
  if (params.dueInMinutes) {
    dueDate.setMinutes(dueDate.getMinutes() + params.dueInMinutes);
  }

  const newTask: Activity = {
    id: 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    contact_id: context.contact_id,
    type: params.type || 'note',
    description: params.description || `[AUTOMATED] Follow up for ${contactName}`,
    due_date: dueDate.toISOString(),
    completed: false
  };

  mockActivities.push(newTask);
  console.log(`[AUTOMATION: TASK CREATED] ${newTask.description}`);
}

function sendNotificationAction(params: any, context: Opportunity) {
  const contact = getContact(context.contact_id, context.user_id);
  const contactName = contact ? contact.name : 'Unknown';
  
  const message = params.message.replace('${contactName}', contactName);
  
  // LOG (placeholder for SMS integration)
  console.log(`%c[AUTOMATION: NOTIFICATION] ${message} (${contactName})`, "color: #007bff; font-weight: bold;");
  
  // Visual Feedback for user
  // Avoid window.alert in pure Node tests
  if (typeof window !== 'undefined') {
    alert(`Automation Notification: ${message}`);
  }
}
