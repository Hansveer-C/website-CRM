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
  created_at: (/* @__PURE__ */ new Date()).toISOString()
};
var mockMessages = [];

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
    created_at: message.created_at || (/* @__PURE__ */ new Date()).toISOString()
  };
  mockMessages.push(finalMessage);
  console.log(`[Message Saved]: ${finalMessage.id} with status "${finalMessage.status}" for contact ${finalMessage.contact_id}`);
  return true;
}
function sortMessagesAsc(messages2) {
  return [...messages2].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
function getConversation(contactId2) {
  const filtered = mockMessages.filter((m) => m.contact_id === contactId2);
  return sortMessagesAsc(filtered);
}

// src/test_opportunity_link.ts
var contactId = "c1";
var oppId = "o-123";
mockMessages.length = 0;
mockOpportunities.length = 0;
mockOpportunities.push({
  id: oppId,
  contact_id: contactId,
  pipeline_stage: "New Lead",
  value: 500,
  assigned_to: "Hansveer",
  status: "open",
  created_at: "2026-03-21T08:00:00Z"
});
saveMessage({
  contact_id: contactId,
  content: "Howdy! Just checking in on your project.",
  direction: "outbound"
});
var messages = getConversation(contactId);
var linkedMessage = messages[0];
console.log("--- TEST: Opportunity Linking ---");
console.log("Message Content:", linkedMessage.content);
console.log("Attached Opportunity ID:", linkedMessage.opportunity_id);
var isLinked = linkedMessage.opportunity_id === oppId;
if (isLinked) {
  console.log("PASSED: Message was automatically linked to the active opportunity.");
} else {
  console.error("FAILED: Message was NOT linked.");
  process.exit(1);
}
