export interface BuilderBlock {
    id: string;
    type: 'hero' | 'services' | 'contact' | 'gallery' | 'trust';
    data: any;
}

export interface WebsiteTemplate {
    id: string;
    name: string;
    description: string;
    blocks: BuilderBlock[];
    theme: {
        primary: string;
        secondary: string;
        font: string;
    };
}

export const templates: WebsiteTemplate[] = [
    {
        id: 'residential-sparkle',
        name: 'Residential Sparkle',
        description: 'Perfect for soft washing and home exterior care specialist.',
        theme: {
            primary: '#00d2ff',
            secondary: '#3a7bd5',
            font: 'Inter'
        },
        blocks: [
            {
                id: 'h1',
                type: 'hero',
                data: {
                    title: 'The Cleanest House on the Block',
                    subtitle: 'Professional Soft Washing & Gutter Cleaning in Los Angeles.',
                    buttonText: 'Get My Free Estimate'
                }
            },
            {
                id: 's1',
                type: 'services',
                data: {
                    title: 'Residential Services',
                    items: ['House Washing', 'Roof Cleaning', 'Gutter Brightening', 'Driveway Sealing']
                }
            },
            {
                id: 'c1',
                type: 'contact',
                data: {
                    title: 'Request a Residential Quote'
                }
            }
        ]
    },
    {
        id: 'commercial-pro',
        name: 'Commercial Pro',
        description: 'Industrial bold styling for large-scale concrete and fleet cleaning.',
        theme: {
            primary: '#ff4b2b',
            secondary: '#ff416c',
            font: 'Roboto'
        },
        blocks: [
            {
                id: 'h2',
                type: 'hero',
                data: {
                    title: 'Industrial Strength Cleaning',
                    subtitle: 'Reliable Fleet and Concrete Maintenance for Commercial Properties.',
                    buttonText: 'Schedule a Consultation'
                }
            },
            {
                id: 's2',
                type: 'services',
                data: {
                    title: 'Commercial Solutions',
                    items: ['Fleet Washing', 'Dumpster Pad Cleaning', 'Parking Lot Restoration', 'Graffiti Removal']
                }
            },
            {
                id: 't2',
                type: 'trust',
                data: {
                    title: 'Trusted by Local Business Leaders',
                    logos: ['Starbucks', 'Walmart', 'Local Mall']
                }
            }
        ]
    },
    {
        id: 'trust-proof',
        name: 'The Trust Proof',
        description: 'Heavy focus on before/after galleries and client testimonials.',
        theme: {
            primary: '#11998e',
            secondary: '#38ef7d',
            font: 'Outfit'
        },
        blocks: [
            {
                id: 'h3',
                type: 'hero',
                data: {
                    title: 'See the Difference for Yourself',
                    subtitle: 'Real Results. Real Reviews. Real Experts.',
                    buttonText: 'View Our Gallery'
                }
            },
            {
                id: 'g3',
                type: 'gallery',
                data: {
                    title: 'Recent Successes',
                    images: ['Before/After 1', 'Before/After 2', 'Before/After 3']
                }
            },
            {
                id: 't3',
                type: 'trust',
                data: {
                    title: 'What Your Neighbors Say',
                    testimonials: [
                        { name: 'Alice R.', text: 'Best service ever!' },
                        { name: 'Bob S.', text: 'My driveway looks new.' }
                    ]
                }
            }
        ]
    }
];
