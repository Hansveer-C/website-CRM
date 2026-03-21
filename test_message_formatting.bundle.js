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
  const finalMessage = {
    id: message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    contact_id: message.contact_id,
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

// src/test_message_formatting.ts
var contactId = "c1";
mockMessages.length = 0;
var longMessage = "This is a very long message that definitely exceeds one hundred characters to test the truncation logic in the timeline view. It should be cut off at around 100 characters.";
saveMessage({
  contact_id: contactId,
  content: longMessage,
  direction: "outbound",
  created_at: "2026-03-21T10:00:00Z"
});
saveMessage({
  contact_id: contactId,
  content: "Hi there!",
  direction: "inbound",
  created_at: "2026-03-21T11:00:00Z"
});
var messages = getConversation(contactId);
var timelineItems = messages.map((m) => {
  const prefix = m.direction === "outbound" ? "Sent SMS: " : "Received SMS: ";
  const displayContent = m.content.length > 100 ? m.content.substring(0, 97) + "..." : m.content;
  return {
    type: "message",
    reference_id: m.id,
    contact_id: contactId,
    content: `${prefix}${displayContent}`,
    created_at: m.created_at,
    metadata: { direction: m.direction, status: m.status }
  };
});
console.log("--- TEST: Message Formatting ---");
timelineItems.forEach((item, index) => {
  console.log(`${index + 1}. [${item.created_at}] CONTENT: ${item.content}`);
});
var isFormatted = timelineItems.length === 2 && timelineItems[0].content.startsWith("Sent SMS: ") && timelineItems[0].content.length <= 110 && // "Sent SMS: " is 10 chars + 100 max
timelineItems[1].content === "Received SMS: Hi there!";
if (isFormatted) {
  console.log("PASSED: Messages correctly use the prefix and apply truncation.");
} else {
  console.error("FAILED: Incorrect message formatting.");
  process.exit(1);
}
