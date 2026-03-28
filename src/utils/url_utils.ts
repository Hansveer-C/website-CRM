/**
 * Generates a clean, SEO-friendly slug from service and city.
 * Example: "Driveway Cleaning", "Port Moody" -> "/driveway-cleaning-port-moody"
 * 
 * Rules:
 * - lowercase
 * - hyphen-separated
 * - remove special characters
 */
export function generateServiceCitySlug(service: string, city: string): string {
    const sanitize = (text: string) => 
        text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // remove special characters
            .trim()
            .replace(/\s+/g, '-');        // hyphen-separated

    const serviceSlug = sanitize(service);
    const citySlug = sanitize(city);

    // Return with leading slash as per example
    return `/${serviceSlug}-${citySlug}`;
}
