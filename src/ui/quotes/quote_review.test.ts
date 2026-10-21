import {it,expect} from 'vitest';
import {allowsLocalQuoteReview,validateOwnerReviewResult,validateRecipientReviewResult,reviewItemTotal} from './quote_review';
it('local review requires development opt-in and both exact loopback endpoints',()=>{
  expect(allowsLocalQuoteReview(true,'true','http://127.0.0.1:4218','https://127.0.0.1:56429')).toBe(true);
  const cases: [boolean,unknown,string,string][]=[
    [false,'true','http://127.0.0.1:4218','https://127.0.0.1:56429'],
    [true,'false','http://127.0.0.1:4218','https://127.0.0.1:56429'],
    [true,undefined,'http://127.0.0.1:4218','https://127.0.0.1:56429'],
    [true,'true','https://website-crm-one.vercel.app','https://127.0.0.1:56429'],
    [true,'true','http://localhost:4218','https://127.0.0.1:56429'],
    [true,'true','http://127.0.0.1:4218','https://example.supabase.co'],
    [true,'true','http://127.0.0.1:4218','https://127.0.0.1:56429.attacker.test']];
  for(const args of cases)expect(allowsLocalQuoteReview(...args)).toBe(false);
});
it('malformed or mismatched mutation responses remain unconfirmed',()=>{
  const args={expected_quote_id:'q',expected_revision:2,p_revision:2,p_customer_text:'text',p_review_id:'r',p_tier:'basic'};
  for(const name of ['create_crm_quote_review','revoke_crm_quote_review','record_crm_quote_review_acceptance'])
    for(const value of [null,{},[],{id:'',quote_id:'q',revision:2,customer_text:'text'},{quote_id:'other',status:'approved',revision:3,replayed:true}])expect(()=>validateOwnerReviewResult(name,value,args)).toThrow();
  for(const value of [null,{},[],{state:'response_received',revision:2,tier:'premium',total:90,currency:'USD',received_at:'now'}])expect(()=>validateRecipientReviewResult(value,args,2,90)).toThrow();
  expect(validateRecipientReviewResult({state:'response_received',revision:2,tier:'basic',total:90,currency:'USD',received_at:'now'},args,2,90).total).toBe(90);
});
it('multiple fractional line totals use SQL-compatible integer minor-unit addition',()=>{
  expect(reviewItemTotal([{total:0.1},{total:0.2}])).toBe(0.3);
  expect(reviewItemTotal([{total:'19.99'},{total:'0.02'}])).toBe(20.01);
  expect(validateRecipientReviewResult({state:'response_received',revision:1,tier:'basic',total:0.3,currency:'USD',received_at:'now'},{p_tier:'basic'},1,reviewItemTotal([{total:0.1},{total:0.2}])).total).toBe(0.3);
});
