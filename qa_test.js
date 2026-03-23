"use strict";

// src/db.ts
var mockContacts = [
  {
    id: "c1",
    name: "John Doe",
    phone: "555-0101",
    email: "john@example.com",
    address: "123 Pine St, Seattle, WA",
    tags: ["residential", "referral"],
    source: "Google Search",
    status: "customer",
    created_at: "2026-02-15T10:00:00Z"
  },
  {
    id: "c2",
    name: "Jane Smith",
    phone: "555-0202",
    email: "jane@smithresidence.com",
    address: "456 Oak Ave, Portland, OR",
    tags: ["lead", "driveway"],
    source: "Facebook Ad",
    status: "lead",
    created_at: "2026-03-01T14:30:00Z"
  }
];
var mockOpportunities = [
  {
    id: "o1",
    contact_id: "c2",
    pipeline_stage: "New Lead",
    value: 250,
    assigned_to: "Hansveer",
    status: "open",
    created_at: "2026-03-01T14:35:00Z"
  },
  {
    id: "o2",
    contact_id: "c1",
    pipeline_stage: "Completed",
    value: 450,
    assigned_to: "Hansveer",
    status: "won",
    created_at: "2026-02-15T10:05:00Z"
  }
];
var mockActivities = [
  {
    id: "a1",
    contact_id: "c2",
    type: "call",
    description: "Initial follow-up call about driveway cleaning",
    due_date: "2026-03-02T09:00:00Z",
    completed: true
  },
  {
    id: "a2",
    contact_id: "c2",
    type: "sms",
    description: "Sent quote via text",
    due_date: "2026-03-05T10:00:00Z",
    completed: false
  }
];
var mockTemplates = [
  {
    id: "tpl1",
    name: "Standard Landing Page",
    category: "Landing Pages",
    sections: [
      {
        type: "hero",
        content: { heading: "Welcome to our Service", subheading: "The best experience you ever had." },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "text",
        content: { heading: "Our Features", body: "Discover why thousands of users trust us every day." },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 2
      },
      {
        type: "form",
        content: { title: "Contact Us", fields: ["name", "email", "message"] },
        styles: { padding: "60px 20px", background: "#f8fafc" },
        order: 3
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "tpl-generic",
    name: "Generic Service Template",
    category: "Landing Pages",
    sections: [
      {
        type: "hero",
        content: { heading: "", subheading: "", button_text: "" },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "text",
        content: { heading: "Our Service", text: "" },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 2
      },
      {
        type: "text",
        content: { heading: "Key Benefits", text: "" },
        styles: { padding: "60px 20px", background: "#f1f5f9" },
        order: 3
      },
      {
        type: "text",
        content: { heading: "Frequently Asked Questions", text: "" },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 4
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "tpl-quote-funnel",
    name: "Quote Funnel Template",
    category: "conversion",
    sections: [
      {
        type: "hero",
        content: { heading: "Expert Exterior Cleaning", subheading: "Professional pressure washing for your home or business.", button_text: "See Our Services" },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "cta",
        content: { heading: "Quick Price Check", subheading: "Need an estimate fast? Fill out our form below.", button_text: "Jump to Form" },
        styles: { padding: "60px 20px", cta_background: "#f1f5f9" },
        order: 2
      },
      {
        type: "form",
        content: { title: "Request Your Free Quote", fields: ["name", "phone", "address", "service_type", "message"] },
        styles: { padding: "80px 20px", background: "#ffffff" },
        order: 3
      },
      {
        type: "text",
        content: {
          heading: "Trusted by local homeowners",
          text: '<p style="text-align: center; max-width: 800px; margin: 0 auto;">We have helped over 500 families protect and beautify their homes with professional results and a local touch. Our specialized equipment ensures a deep clean without damaging your surfaces.</p>'
        },
        styles: { padding: "60px 20px", background: "#f8fafc" },
        order: 4
      },
      {
        type: "cta",
        content: { heading: "Start Your Project Today", subheading: "Professional results are just a click away.", button_text: "Get Started Now" },
        styles: { padding: "100px 20px", cta_background: "#4f46e5" },
        order: 5
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var mockWebsiteSettings = {
  id: "settings-001",
  business_name: "Handyman Hans Pressure Washing",
  phone: "555-0199",
  email: "hans@example.com",
  logo_url: "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?q=80&w=200&h=200&auto=format&fit=crop",
  primary_color: "#4f46e5",
  facebook_pixel_id: "",
  gtm_id: "",
  auto_lead_sms_enabled: true,
  auto_lead_sms_template: "Hey {name}, thanks for reaching out! I'll get back to you ASAP.",
  missed_call_sms_enabled: true,
  missed_call_sms_template: "",
  created_at: (/* @__PURE__ */ new Date()).toISOString()
};
var mockEventLogs = [];
var mockMessages = [];
var mockCalls = [];

// src/config.ts
var import_meta = {};
var twilioConfig = {
  account_sid: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_ACCOUNT_SID || "",
  auth_token: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_AUTH_TOKEN || "",
  sending_phone_number: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_PHONE_NUMBER || ""
};

// src/messages.ts
function saveMessage(message) {
  const contactExists = mockContacts.some((c) => c.id === message.contact_id);
  if (!contactExists) {
    console.error(`[Message Error] Invalid contact_id: ${message.contact_id}`);
    return false;
  }
  if (!message.opportunity_id) {
    const latestOpp = mockOpportunities.filter((o) => o.contact_id === message.contact_id && o.status === "open").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (latestOpp) {
      message.opportunity_id = latestOpp.id;
    }
  }
  const finalMessage = {
    id: message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    contact_id: message.contact_id,
    opportunity_id: message.opportunity_id,
    direction: message.direction || "outbound",
    type: message.type || "sms",
    content: message.content || "",
    status: message.status || "pending",
    // Default to 'pending'
    source: message.source,
    created_at: message.created_at || (/* @__PURE__ */ new Date()).toISOString()
  };
  mockMessages.push(finalMessage);
  console.log(`[Message Saved]: ${finalMessage.id} with status "${finalMessage.status}" for contact ${finalMessage.contact_id}`);
  return true;
}

// src/sms.ts
function getDefaultLeadReply(contact, template) {
  const name = contact?.name?.trim() || "";
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || "there");
  }
  const greeting = name ? `Hey ${name}` : "Hey there";
  return `${greeting}, thanks for reaching out! I got your request and will get back to you shortly.`;
}
function getMissedCallReply(contact, template) {
  const name = (contact?.name?.trim() || "").replace("Unknown Caller", "");
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || "there");
  }
  if (!name) {
    return "Hey, sorry I missed your call. How can I help?";
  }
  return `Hey ${name}, sorry I missed your call. How can I help?`;
}
async function sendSMS(phone, message) {
  const { account_sid, auth_token, sending_phone_number } = twilioConfig;
  if (!account_sid || !auth_token || !sending_phone_number) {
    const errorMsg = "Twilio credentials not fully configured in environment variables.";
    console.error(`[SMS SERVICE] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;
  const auth = btoa(`${account_sid}:${auth_token}`);
  const params = new URLSearchParams();
  params.append("To", phone);
  params.append("From", sending_phone_number);
  params.append("Body", message);
  try {
    console.log(`[SMS SERVICE] Attempting to send message to ${phone}...`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const data = await response.json();
    if (response.ok) {
      console.log(`\u2705 [SMS SERVICE] Message successfully dispatched. Twilio SID: ${data.sid}`);
      return {
        success: true,
        provider_message_id: data.sid
      };
    } else {
      const errorDetail = data.message || response.statusText;
      console.error(`\u274C [SMS SERVICE] Dispatch failed: ${errorDetail}`);
      return {
        success: false,
        error: errorDetail
      };
    }
  } catch (error) {
    console.error(`\u274C [SMS SERVICE] Network or Runtime Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
async function dispatchSMS(contact_id, phone, messageText, opportunity_id, source) {
  const newMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    contact_id,
    opportunity_id,
    direction: "outbound",
    type: "sms",
    content: messageText,
    status: "pending",
    source,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  saveMessage(newMessage);
  console.log(`[DISPATCH] Message record created with status "pending": ${newMessage.id}`);
  const result = await sendSMS(phone, messageText);
  const dbRecord = mockMessages.find((m) => m.id === newMessage.id);
  if (dbRecord) {
    if (result.success) {
      dbRecord.status = "sent";
      dbRecord.retryable = false;
      dbRecord.provider_message_id = result.provider_message_id;
      console.log(`\u2705 [DISPATCH] Message ${dbRecord.id} marked as 'sent'. Provider ID: ${result.provider_message_id}`);
    } else {
      dbRecord.status = "failed";
      dbRecord.retryable = true;
      console.error(`\u274C [DISPATCH] Message ${dbRecord.id} marked as 'failed'. Error: ${result.error}`);
    }
  }
  return {
    internal_id: newMessage.id,
    twilio_result: result
  };
}
async function sendMessageToContact(contact_id, messageText, source) {
  const contact = mockContacts.find((c) => c.id === contact_id);
  if (!contact) {
    const errorMsg = `Contact lookup failed: ID ${contact_id} not found in database.`;
    console.error(`[CONTACT HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  if (!contact.phone) {
    const errorMsg = `SMS Aborted: Contact ${contact.name} (${contact_id}) has no phone number recorded.`;
    console.error(`[CONTACT HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  const now = (/* @__PURE__ */ new Date()).getTime();
  const isDuplicate = mockMessages.some(
    (m) => m.contact_id === contact_id && m.direction === "outbound" && m.content === messageText && now - new Date(m.created_at).getTime() < 6e4
  );
  if (isDuplicate) {
    const errorMsg = `Duplicate SMS prevented`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: '${messageText}' was already sent to ${contact.name} within the last 60 seconds.`);
    return { success: false, error: errorMsg };
  }
  const recentMessagesCount = mockMessages.filter(
    (m) => m.contact_id === contact_id && m.direction === "outbound" && now - new Date(m.created_at).getTime() < 6e4
  ).length;
  if (recentMessagesCount >= 3) {
    const errorMsg = `Rate limit hit`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: Contact ${contact.name} has already received 3 messages in the last minute.`);
    return { success: false, error: errorMsg };
  }
  console.log(`[CONTACT HELPER] Initializing SMS lifecycle for ${contact.name}...`);
  const result = await dispatchSMS(contact_id, contact.phone, messageText, void 0, source);
  return {
    success: result.twilio_result.success,
    internal_id: result.internal_id,
    error: result.twilio_result.error
  };
}

// src/events.ts
var listeners = {};
function onEvent(name, callback) {
  if (!listeners[name]) {
    listeners[name] = [];
  }
  listeners[name].push(callback);
}
function createEvent(name, payload = {}) {
  return {
    event_name: name,
    payload,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var eventLog = [];
async function emitEvent(name, payload = {}) {
  if (name === "form_submitted" || name === "lead_created") {
    if (!payload.contact_id || !payload.opportunity_id) {
      console.error("Invalid event payload", { event_name: name, payload });
      return null;
    }
  }
  const event = createEvent(name, payload);
  eventLog.push(event);
  const logEntry = {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    event_name: event.event_name,
    payload: event.payload,
    status: "pending",
    created_at: event.created_at
  };
  mockEventLogs.push(logEntry);
  logEntry.status = "processed";
  console.log("[Event Logged]:", event);
  if (listeners[name]) {
    for (const fn of listeners[name]) {
      try {
        await fn(payload);
      } catch (e) {
        console.error(`[Event Listener Error] ${name}:`, e);
      }
    }
  }
  return event;
}
onEvent("lead_created", async (payload) => {
  if (!mockWebsiteSettings.auto_lead_sms_enabled) {
    console.log("Automated lead SMS skipped: auto-response disabled globally");
    return;
  }
  console.log("Lead created event received");
  const contact_id = payload.contact_id;
  let phone = payload.phone;
  if (!phone && contact_id) {
    const contact2 = mockContacts.find((c) => c.id === contact_id);
    if (contact2 && contact2.phone) {
      phone = contact2.phone;
    }
  }
  if (!phone) {
    console.log("Automated lead SMS skipped: No phone available");
    return;
  }
  const contact = mockContacts.find((c) => c.id === contact_id);
  if (!contact) {
    console.log("Contact not found for SMS");
    return;
  }
  const template = mockWebsiteSettings.auto_lead_sms_template;
  const message = getDefaultLeadReply(contact, template);
  const now = Date.now();
  const twoMinutesAgo = now - 2 * 60 * 1e3;
  const alreadySent = mockMessages.some(
    (m) => m.contact_id === contact_id && m.direction === "outbound" && new Date(m.created_at).getTime() >= twoMinutesAgo && (m.content === message || m.content.includes("thanks for reaching out"))
  );
  if (alreadySent) {
    console.log("Automated lead SMS skipped: duplicate prevented");
    return;
  }
  console.log(`[AUTOMATION] Triggering automated SMS for lead: ${contact.name}`);
  const result = await sendMessageToContact(contact_id, message, "automation");
  if (result.success) {
    console.log("Automated lead SMS sent");
  } else {
    console.log("Auto SMS failed");
    contact.follow_up_required = true;
  }
});
onEvent("call_missed", async (payload) => {
  console.log("call_missed event received");
  if (!mockWebsiteSettings.missed_call_sms_enabled) {
    console.log("Missed call SMS disabled");
    return;
  }
  const { phone, call_id } = payload;
  if (!phone) {
    console.log("[SMS PREP] No phone provided, exiting");
    return;
  }
  const phoneNorm = normalizePhone(phone);
  const existingContact = mockContacts.find((c) => c.phone === phoneNorm.normalized);
  let contactIdToUse;
  if (existingContact) {
    console.log(`Contact matched: ${existingContact.name} (${existingContact.id})`);
    contactIdToUse = existingContact.id;
  } else {
    const newContact = {
      id: `c-${Date.now()}`,
      name: "Unknown Caller",
      phone: phoneNorm.normalized,
      email: null,
      address: "New lead from missed call",
      tags: ["missed-call"],
      source: "missed_call",
      status: "lead",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    mockContacts.push(newContact);
    console.log("New contact created from missed call");
    contactIdToUse = newContact.id;
  }
  const targetContact = mockContacts.find((c) => c.id === contactIdToUse);
  if (!targetContact) {
    console.log("[SMS PREP] No contact resolved, exiting");
    return;
  }
  console.log(`[SMS PREP] Target contact resolved: ${targetContact.name} (${targetContact.id})`);
  const now = Date.now();
  const recentAutomation = mockMessages.find(
    (m) => m.contact_id === targetContact.id && m.source === "missed_call_automation" && now - new Date(m.created_at).getTime() < 12e4
    // 2 minutes
  );
  if (recentAutomation) {
    console.log("Missed call SMS already sent");
    console.log(`[SMS SKIPPED] Prevented duplicate follow-up within 2-minute window for ${targetContact.name}`);
    return;
  }
  const fiveMinutesAgo = now - 3e5;
  const recentCount = mockMessages.filter(
    (m) => m.contact_id === targetContact.id && m.source === "missed_call_automation" && new Date(m.created_at).getTime() > fiveMinutesAgo
  ).length;
  if (recentCount >= 2) {
    console.log("Missed call SMS rate limited");
    console.warn(`[SMS SKIPPED] Rate limit of 2 messages reached within 5 minutes for ${targetContact.name}`);
    return;
  }
  const smsMessage = getMissedCallReply(targetContact, mockWebsiteSettings.missed_call_sms_template);
  console.log(`[SMS PREP] Message prepared: "${smsMessage}"`);
  const smsResult = await sendMessageToContact(targetContact.id, smsMessage, "missed_call_automation");
  if (smsResult.success) {
    console.log("Missed call SMS sent");
    console.log(`[SMS SUCCESS] Automated reply sent to ${targetContact.name}: "${smsMessage}"`);
  } else if (smsResult.error === "Duplicate SMS prevented" || smsResult.error === "Rate limit hit") {
    console.log("Missed call SMS skipped");
    console.warn(`[SMS SKIPPED] ${smsResult.error} for ${targetContact.name}`);
  } else {
    console.log("Missed call SMS failed");
    console.error(`[SMS FAILURE] Could not send reply to ${targetContact.name}: ${smsResult.error}`);
    targetContact.follow_up_required = true;
  }
  const newOpportunity = {
    id: `opp-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    contact_id: contactIdToUse,
    pipeline_stage: "New Lead",
    status: "open",
    value: 0,
    assigned_to: "Unassigned",
    source: "missed_call",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  mockOpportunities.push(newOpportunity);
  console.log(`Opportunity created for contact ${contactIdToUse}`);
  if (call_id) {
    const callRecord = mockCalls.find((c) => c.id === call_id);
    if (callRecord) {
      callRecord.contact_id = contactIdToUse;
      callRecord.opportunity_id = newOpportunity.id;
      console.log(`Call record ${call_id} linked to contact ${contactIdToUse} and opportunity ${newOpportunity.id}`);
    }
  }
});

// src/automation.ts
var automations = [
  {
    id: "a1",
    name: "Auto-follow task for new leads",
    trigger: "OPPORTUNITY_CREATED",
    action: "CREATE_TASK",
    actionParams: {
      type: "call",
      description: "Call new lead ASAP",
      dueInMinutes: 10
    }
  },
  {
    id: "a2",
    name: "Notify when job is scheduled",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Scheduled",
    action: "SEND_NOTIFICATION",
    actionParams: {
      message: "\u{1F389} A job has been scheduled! Get ready."
    }
  },
  {
    id: "a3",
    name: "Final follow up when completed",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Completed",
    action: "CREATE_TASK",
    actionParams: {
      type: "visit",
      description: "Site cleanup & final inspection",
      dueInDays: 0
    }
  },
  {
    id: "a4",
    name: "Follow up on sent quote",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Quote Sent",
    action: "CREATE_TASK",
    actionParams: {
      type: "note",
      description: "Follow up on quote in 24 hours",
      dueInDays: 1
    }
  }
];
function runAutomations(trigger, context) {
  const activeAutomations = automations.filter(
    (a) => a.trigger === trigger && (!a.condition || a.condition(context))
  );
  activeAutomations.forEach((automation) => {
    executeAction(automation, context);
  });
}
function executeAction(automation, context) {
  switch (automation.action) {
    case "CREATE_TASK":
      createTaskAction(automation.actionParams, context);
      break;
    case "SEND_NOTIFICATION":
      sendNotificationAction(automation.actionParams, context);
      break;
  }
}
function createTaskAction(params, context) {
  const contact = mockContacts.find((c) => c.id === context.contact_id);
  const contactName = contact ? contact.name : "Unknown";
  const dueDate = /* @__PURE__ */ new Date();
  if (params.dueInDays) {
    dueDate.setDate(dueDate.getDate() + params.dueInDays);
  }
  if (params.dueInMinutes) {
    dueDate.setMinutes(dueDate.getMinutes() + params.dueInMinutes);
  }
  const newTask = {
    id: "task-" + Date.now() + "-" + Math.floor(Math.random() * 1e3),
    contact_id: context.contact_id,
    type: params.type || "note",
    description: params.description || `[AUTOMATED] Follow up for ${contactName}`,
    due_date: dueDate.toISOString(),
    completed: false
  };
  mockActivities.push(newTask);
  console.log(`[AUTOMATION: TASK CREATED] ${newTask.description}`);
}
function sendNotificationAction(params, context) {
  const contact = mockContacts.find((c) => c.id === context.contact_id);
  const contactName = contact ? contact.name : "Unknown";
  const message = params.message.replace("${contactName}", contactName);
  console.log(`%c[AUTOMATION: NOTIFICATION] ${message} (${contactName})`, "color: #007bff; font-weight: bold;");
  alert(`Automation Notification: ${message}`);
}

// src/leads_logic.ts
function normalizePhone(phone) {
  if (!phone)
    return { normalized: "", invalid: true };
  const cleaned = phone.replace(/[\s\-\(\)\[\]\{\}\.\,\/]/g, "").replace(/\D/g, "");
  if (cleaned.length === 10) {
    return { normalized: `+1${cleaned}`, invalid: false };
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return { normalized: `+${cleaned}`, invalid: false };
  }
  return { normalized: cleaned || phone, invalid: true };
}
function normalizeEmail(email) {
  if (!email || !email.trim())
    return null;
  return email.trim().toLowerCase();
}
function normalizeName(name) {
  if (!name)
    return "";
  return name.trim().replace(/\s\s+/g, " ");
}
async function createLead(data) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const phoneNorm = normalizePhone(data.phone || "");
  const emailNorm = normalizeEmail(data.email);
  const normalizedName = normalizeName(data.name);
  if (!normalizedName) {
    throw new Error("Name is required for lead creation.");
  }
  const existingContact = mockContacts.find(
    (c) => phoneNorm.normalized && c.phone === phoneNorm.normalized || emailNorm && c.email === emailNorm
  );
  let contactIdToUse;
  if (existingContact) {
    contactIdToUse = existingContact.id;
    console.log(`Duplicate lead found: using existing contact ${contactIdToUse}.`);
    const recentOpp = mockOpportunities.find(
      (opp) => opp.contact_id === contactIdToUse && (/* @__PURE__ */ new Date()).getTime() - new Date(opp.created_at).getTime() < 12e4
    );
    if (recentOpp) {
      throw new Error(`Duplicate submission window open for contact ${contactIdToUse}.`);
    }
  } else {
    contactIdToUse = `c-${Date.now()}`;
    const newContact = {
      id: contactIdToUse,
      name: normalizedName,
      phone: phoneNorm.normalized,
      email: emailNorm,
      address: data.address || "Lead API Submission",
      tags: ["web-lead"],
      source: data.source || "api",
      service: data.service_type || void 0,
      status: "lead",
      created_at: timestamp,
      invalid_phone: phoneNorm.invalid || void 0
    };
    mockContacts.push(newContact);
  }
  const newOpportunity = {
    id: `opp-${Date.now()}`,
    contact_id: contactIdToUse,
    pipeline_stage: "New Lead",
    value: 0,
    assigned_to: "Unassigned",
    status: "open",
    notes: `Service Type: ${data.service_type || "N/A"}
Address: ${data.address || "N/A"}
Message: ${data.message || "N/A"}`,
    created_at: timestamp
  };
  mockOpportunities.push(newOpportunity);
  const emissionsInThisCycle = /* @__PURE__ */ new Set();
  const guardedEmit = (name, payload) => {
    if (!emissionsInThisCycle.has(name)) {
      emitEvent(name, payload);
      emissionsInThisCycle.add(name);
    }
  };
  guardedEmit("lead_created", {
    contact_id: contactIdToUse,
    opportunity_id: newOpportunity.id,
    phone: phoneNorm.normalized,
    email: emailNorm,
    pipeline_stage: "New Lead",
    source: data.source || "api"
  });
  runAutomations("OPPORTUNITY_CREATED", newOpportunity);
  return {
    contactId: contactIdToUse,
    opportunityId: newOpportunity.id,
    status: "success"
  };
}

// src/calls_logic.ts
async function handleInboundCall(data) {
  if (!data || !data.phone) {
    const errorMsg = "Phone number is required for inbound call.";
    console.error(`[API ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  const phoneNorm = normalizePhone(data.phone);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`Inbound call received from ${phoneNorm.normalized}`);
  const callRecord = {
    id: `call-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    phone: phoneNorm.normalized,
    direction: "inbound",
    status: "received",
    created_at: timestamp
  };
  mockCalls.push(callRecord);
  await emitEvent("call_received", {
    phone: phoneNorm.normalized,
    source: "mock_call",
    timestamp
  });
  return {
    status: "received",
    phone: phoneNorm.normalized,
    callId: callRecord.id,
    // Helpful to return the record ID
    timestamp
  };
}
async function endCall(data) {
  if (!data || !data.call_id) {
    throw new Error("call_id is required to end a call.");
  }
  const call = mockCalls.find((c) => c.id === data.call_id);
  if (!call) {
    const errorMsg = `Call with ID ${data.call_id} not found.`;
    console.error(`[API ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  if (call.status === "answered" || call.status === "missed") {
    console.log(`Call already processed: ${call.status}`);
    return {
      status: "ignored",
      callId: call.id,
      currentStatus: call.status,
      message: "Call already processed"
    };
  }
  call.status = data.answered ? "answered" : "missed";
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`Call ended: ${call.status}`);
  if (!data.answered) {
    await emitEvent("call_missed", {
      phone: call.phone,
      call_id: call.id,
      timestamp
    });
  }
  return {
    status: "updated",
    callId: call.id,
    newStatus: call.status,
    timestamp
  };
}

// src/timeline.ts
function getContactTimeline(contact_id) {
  const contact = mockContacts.find((c) => c.id === contact_id);
  const phone = contact?.phone;
  const messages = mockMessages.filter((m) => m.contact_id === contact_id);
  const eventLogs = mockEventLogs.filter((e) => {
    if (!e.payload)
      return false;
    return e.payload.contact_id === contact_id || phone && e.payload.phone === phone;
  });
  const activities = mockActivities.filter((a) => a.contact_id === contact_id);
  const calls = mockCalls.filter((c) => c.contact_id === contact_id || phone && c.phone === phone);
  const messageItems = messages.map((m) => {
    const isOutbound = m.direction === "outbound";
    const arrow = isOutbound ? "\u2192" : "\u2190";
    const prefix = isOutbound ? "Sent SMS" : "Received SMS";
    const displayContent = m.content.length > 120 ? m.content.substring(0, 117) + "..." : m.content;
    return {
      type: "message",
      content: `${arrow} ${prefix}: ${displayContent}`,
      created_at: m.created_at,
      reference_id: m.id,
      contact_id: m.contact_id,
      metadata: { direction: m.direction, status: m.status }
    };
  });
  const eventItems = eventLogs.map((e) => {
    let type = "event";
    let content = "";
    if (e.event_name === "form_submitted" || e.event_name === "form_submission") {
      type = "form_submission";
      content = "Form submitted via website";
    } else if (e.event_name === "call_received") {
      type = "event";
      content = "\u{1F4DE} Inbound call: STARTED";
    } else if (e.event_name === "call_missed") {
      type = "call_missed";
      content = `[MISSED CALL] Incoming call from ${e.payload.phone || "Unknown"}`;
    } else {
      type = "event";
      content = `Event: ${e.event_name}`;
    }
    return {
      type,
      content,
      created_at: e.created_at,
      reference_id: e.id,
      contact_id,
      metadata: { ...e.payload }
    };
  });
  const callItems = calls.map((c) => {
    const direction = c.direction === "inbound" ? "Inbound call" : "Outbound call";
    const isMissed = c.status === "missed";
    let content = isMissed ? `[MISSED CALL] Incoming call from ${c.phone}` : `\u{1F4DE} ${direction}: ${c.status.toUpperCase()}`;
    if (c.duration && c.duration > 0) {
      content += ` (${c.duration}s)`;
    }
    return {
      type: isMissed ? "call_missed" : "event",
      content,
      created_at: c.created_at,
      reference_id: c.id,
      contact_id,
      metadata: { status: c.status, direction: c.direction, duration: c.duration || 0 }
    };
  });
  const activityItems = activities.map((a) => ({
    type: "event",
    content: `Event: ${a.type.toUpperCase()}`,
    created_at: a.due_date,
    reference_id: a.id,
    contact_id: a.contact_id,
    metadata: { completed: a.completed, activityType: a.type, description: a.description }
  }));
  const allItems = [...messageItems, ...eventItems, ...callItems, ...activityItems].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const now = /* @__PURE__ */ new Date();
  const todayStr = formatDateForComparison(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = formatDateForComparison(yesterday);
  const todayItems = [];
  const yesterdayItems = [];
  const earlierItems = [];
  allItems.forEach((item, idx) => {
    const itemDate = formatDateForComparison(new Date(item.created_at));
    const isLatest = idx === allItems.length - 1;
    const displayItem = {
      ...item,
      is_latest: isLatest,
      created_at: formatTimelineTime(item.created_at)
    };
    if (itemDate === todayStr) {
      todayItems.push(displayItem);
    } else if (itemDate === yesterdayStr) {
      yesterdayItems.push(displayItem);
    } else {
      earlierItems.push(displayItem);
    }
  });
  return [
    { label: "Earlier", items: earlierItems },
    { label: "Yesterday", items: yesterdayItems },
    { label: "Today", items: todayItems }
  ];
}
function formatTimelineTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  } catch (e) {
    return timestamp;
  }
}
function formatDateForComparison(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

// qa_full_test.ts
async function runQATests() {
  console.log("================================================");
  console.log("   CRM QA REGRESSION SUITE - END-TO-END TEST    ");
  console.log("================================================\n");
  const results = [];
  console.log("[TEST 1] Form Lead Flow");
  try {
    const payload = {
      name: "QA Form Lead",
      phone: "1234567890",
      email: "qa.form@test.com",
      source: "website"
    };
    const res = await createLead(payload);
    const contact = mockContacts.find((c) => c.id === res.contactId);
    const opportunity = mockOpportunities.find((o) => o.id === res.opportunityId);
    const event = mockEventLogs.find((e) => e.event_name === "lead_created" && e.payload.contact_id === res.contactId);
    const sms = mockMessages.find((m) => m.contact_id === res.contactId && m.source === "automation");
    if (contact && opportunity && event && sms) {
      console.log("\u2705 PASS: Contact, Opportunity, Event, and SMS created.");
      results.push({ test: "Form Lead Flow", status: "PASS" });
    } else {
      console.log("\u274C FAIL: Missing components.", { contact: !!contact, opp: !!opportunity, event: !!event, sms: !!sms });
      results.push({ test: "Form Lead Flow", status: "FAIL", reason: "Missing components" });
    }
  } catch (err) {
    console.log("\u274C FAIL: Exception during Form Lead Flow:", err.message);
    results.push({ test: "Form Lead Flow", status: "FAIL", reason: err.message });
  }
  console.log("\n[TEST 2] Missed Call Flow");
  try {
    const callRes = await handleInboundCall({ phone: "9876543210" });
    await endCall({ call_id: callRes.callId, answered: false });
    const contact = mockContacts.find((c) => c.phone === "+19876543210");
    const opportunity = mockOpportunities.find((o) => o.contact_id === contact?.id && o.source === "missed_call");
    const event = mockEventLogs.find((e) => e.event_name === "call_missed" && e.payload.call_id === callRes.callId);
    const sms = mockMessages.find((m) => m.contact_id === contact?.id && m.source === "missed_call_automation");
    if (contact && opportunity && event && sms) {
      console.log("\u2705 PASS: Missed call handled, contact/opp created, SMS triggered.");
      results.push({ test: "Missed Call Flow", status: "PASS" });
    } else {
      console.log("\u274C FAIL: Missing components.", { contact: !!contact, opp: !!opportunity, event: !!event, sms: !!sms });
      results.push({ test: "Missed Call Flow", status: "FAIL", reason: "Missing components" });
    }
  } catch (err) {
    console.log("\u274C FAIL: Exception during Missed Call Flow:", err.message);
    results.push({ test: "Missed Call Flow", status: "FAIL", reason: err.message });
  }
  console.log("\n[TEST 3] Duplicate Protection");
  try {
    const initialCount = mockContacts.length;
    try {
      await createLead({ name: "Duplicate Lead", phone: "1234567890" });
    } catch (e) {
      console.log("   Caught expected duplicate window error:", e.message);
    }
    const finalCount = mockContacts.length;
    const smsCount = mockMessages.filter((m) => m.content.includes("thanks for reaching out")).length;
    if (finalCount === initialCount && smsCount === 1) {
      console.log("\u2705 PASS: No duplicate contact, no duplicate SMS.");
      results.push({ test: "Duplicate Protection", status: "PASS" });
    } else {
      console.log("\u274C FAIL: Duplicates found.", { contacts: finalCount - initialCount, sms: smsCount });
      results.push({ test: "Duplicate Protection", status: "FAIL", reason: "Duplicates found" });
    }
  } catch (err) {
    console.log("\u274C FAIL: Exception during Duplicate Protection:", err.message);
    results.push({ test: "Duplicate Protection", status: "FAIL", reason: err.message });
  }
  console.log("\n[TEST 4] Failure Test");
  try {
    const oldSid = mockWebsiteSettings.id;
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ message: "API Down" })
    });
    await createLead({ name: "Failure Test", phone: "5550009999" });
    const failedSms = mockMessages.find((m) => m.content.includes("thanks for reaching out") && m.status === "failed");
    if (failedSms && failedSms.retryable === true) {
      console.log("\u2705 PASS: SMS status = failed, retryable = true.");
      results.push({ test: "Failure Test", status: "PASS" });
    } else {
      console.log("\u274C FAIL: Incorrect failure state.", { sms: !!failedSms, retryable: failedSms?.retryable });
      results.push({ test: "Failure Test", status: "FAIL", reason: "Incorrect failure state" });
    }
    global.fetch = originalFetch;
  } catch (err) {
    console.log("\u274C FAIL: Exception during Failure Test:", err.message);
    results.push({ test: "Failure Test", status: "FAIL", reason: err.message });
  }
  console.log("\n[TEST 5] Timeline Test");
  try {
    const contact = mockContacts.find((c) => c.name === "QA Form Lead");
    if (!contact)
      throw new Error("Contact not found");
    const timelineGroups = getContactTimeline(contact.id);
    const allItems = timelineGroups.flatMap((g) => g.items);
    console.log("   Timeline entries:", allItems.length);
    const hasLeadCreated = allItems.some((t) => t.content.includes("lead_created"));
    const hasSms = allItems.some((t) => t.type === "message");
    if (allItems.length >= 2 && hasLeadCreated && hasSms) {
      console.log("\u2705 PASS: Timeline includes lead event and SMS in correct order.");
      results.push({ test: "Timeline Test", status: "PASS" });
    } else {
      console.log("\u274C FAIL: Timeline missing entries.", { length: allItems.length, hasLeadCreated, hasSms });
      results.push({ test: "Timeline Test", status: "FAIL", reason: "Timeline incomplete" });
    }
  } catch (err) {
    console.log("\u274C FAIL: Exception during Timeline Test:", err.message);
    results.push({ test: "Timeline Test", status: "FAIL", reason: err.message });
  }
  console.log("\n================================================");
  console.log("                FINAL SUMMARY                   ");
  console.log("================================================");
  results.forEach((r) => console.log(`${r.status.padEnd(6)} | ${r.test}${r.reason ? " - " + r.reason : ""}`));
  const allPass = results.every((r) => r.status === "PASS");
  console.log(`
OVERALL VERDICT: ${allPass ? "READY" : "NOT READY"}`);
}
runQATests().catch(console.error);
