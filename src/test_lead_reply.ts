import { getDefaultLeadReply } from './sms';

const mockWithContactName = { name: 'John Doe', phone: '+1234567890' };
const mockWithoutName = { phone: '+1234567890' };

console.log("TEST 1 - With Name:");
console.log(getDefaultLeadReply(mockWithContactName));

console.log("\nTEST 2 - Without Name:");
console.log(getDefaultLeadReply(mockWithoutName));
