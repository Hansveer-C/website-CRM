import { generateServiceCitySlug } from './utils/url_utils';

async function testSlugGeneration() {
    console.log('--- Testing SEO-Friendly Slug Generation (PROMPT W3.2) ---');

    const testCases = [
        { service: 'Driveway Cleaning', city: 'Port Moody', expected: '/driveway-cleaning-port-moody' },
        { service: 'House Washing!!!', city: 'Coquitlam   ', expected: '/house-washing-coquitlam' },
        { service: 'Roof Moss Removal', city: 'Vancouver, BC', expected: '/roof-moss-removal-vancouver-bc' },
        { service: '   Gutter Cleaning   ', city: 'Burnaby BC', expected: '/gutter-cleaning-burnaby-bc' },
        { service: 'Driveway @& Cleaning', city: 'Port Moody', expected: '/driveway-cleaning-port-moody' },
    ];

    let passed = 0;
    for (const test of testCases) {
        const result = generateServiceCitySlug(test.service, test.city);
        if (result === test.expected) {
            console.log(`✅ Passed: "${test.service}", "${test.city}" -> ${result}`);
            passed++;
        } else {
            console.error(`❌ Failed: "${test.service}", "${test.city}" -> Expected: ${test.expected}, Got: ${result}`);
        }
    }

    console.log(`\nResults: ${passed}/${testCases.length} passed.`);
    if (passed !== testCases.length) process.exit(1);
}

testSlugGeneration();
