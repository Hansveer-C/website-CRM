import { Automation, TriggerType, Opportunity, Activity } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { getContact } from './contacts_repo';
import { createActivity } from './activities_repo';

// In-memory triggers remain for non-persisted events
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

export async function runAutomations(trigger: TriggerType, context: any) {
  const activeAutomations = automations.filter(a => 
    a.trigger === trigger && (!a.condition || a.condition(context))
  );

  for (const automation of activeAutomations) {
    await executeAction(automation, context);
  }
}

async function executeAction(automation: Automation, context: any) {
  switch (automation.action) {
    case 'CREATE_TASK':
      await createTaskAction(automation.actionParams, context);
      break;
    case 'SEND_NOTIFICATION':
      await sendNotificationAction(automation.actionParams, context);
      break;
  }
}

async function createTaskAction(params: any, context: Opportunity) {
  const contactRes = await getContact(context.contact_id, context.user_id);
  const contact = contactRes.success ? contactRes.data : null;
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
    user_id: context.user_id || 'system',
    contact_id: context.contact_id,
    type: params.type || 'note',
    description: params.description || `[AUTOMATED] Follow up for ${contactName}`,
    due_date: dueDate.toISOString(),
    completed: false
  };

  await createActivity(newTask);
  console.log(`[AUTOMATION: TASK CREATED] ${newTask.description}`);
}

async function sendNotificationAction(params: any, context: Opportunity) {
  const contactRes = await getContact(context.contact_id, context.user_id);
  const contact = contactRes.success ? contactRes.data : null;
  const contactName = contact ? contact.name : 'Unknown';
  
  const message = params.message.replace('${contactName}', contactName);
  
  // LOG (placeholder for SMS integration)
  console.log(`%c[AUTOMATION: NOTIFICATION] ${message} (${contactName})`, "color: #007bff; font-weight: bold;");
}
