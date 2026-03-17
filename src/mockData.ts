export interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: 'Lead' | 'Quote Sent' | 'Job Scheduled' | 'Completed';
    lastContact: string;
    service: string;
}

export const mockClients: Client[] = [
    {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-0101',
        status: 'Job Scheduled',
        lastContact: '2026-02-23',
        service: 'Full House Wash'
    },
    {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@smithresidence.com',
        phone: '555-0202',
        status: 'Lead',
        lastContact: '2026-02-24',
        service: 'Driveway Cleaning'
    },
    {
        id: '3',
        name: 'Solar Power Co.',
        email: 'ops@solarpower.com',
        phone: '555-0303',
        status: 'Quote Sent',
        lastContact: '2026-02-22',
        service: 'Solar Panel Wash'
    }
];
