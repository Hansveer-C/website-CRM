import { getContactTimeline } from './timeline';

async function test() {
    const res = await getContactTimeline('any', 'system');
    console.log('RESULT:', JSON.stringify(res, null, 2));
}
test();
