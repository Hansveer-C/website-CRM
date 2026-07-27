/**
 * Classifies the page type based on the path and optional route properties.
 * 
 * Rules:
 * - "/" should be homepage.
 * - route with both service and city should be service_city.
 * - route with service only should be service.
 * - route with city only should be city.
 * - fallback should be unknown.
 */
export type PageType = 'homepage' | 'service' | 'city' | 'service_city' | 'unknown';

export interface AttributionDetails {
  source_page: string;
  source_page_type: PageType;
  source_service: string;
  source_city: string;
  landing_page: string;
}

export function detectPageType(path: string, service?: string, city?: string): PageType {
  const cleanPath = (path || '').trim();
  if (cleanPath === '/' || cleanPath === '' || cleanPath === '/site' || cleanPath === '/site/') {
    return 'homepage';
  }
  if (service && city) {
    return 'service_city';
  }
  if (service) {
    return 'service';
  }
  if (city) {
    return 'city';
  }
  return 'unknown';
}

export function parseAttributionFromPath(path: string): AttributionDetails {
  let cleanPath = (path || '/').trim();
  
  // Normalize path
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }

  // Strip site/preview prefix for slug resolution
  let landingPath = cleanPath;
  if (landingPath.startsWith('/site/')) {
    landingPath = landingPath.replace('/site', '');
  } else if (landingPath === '/site') {
    landingPath = '/';
  }
  if (landingPath.startsWith('/preview/')) {
    landingPath = landingPath.replace('/preview', '');
  } else if (landingPath === '/preview') {
    landingPath = '/';
  }

  if (landingPath === '/' || landingPath === '') {
    return {
      source_page: cleanPath,
      source_page_type: 'homepage',
      source_service: '',
      source_city: '',
      landing_page: cleanPath
    };
  }

  // pre-defined known mappings
  const serviceMappings: Record<string, string> = {
    'driveway-cleaning': 'Driveway Cleaning',
    'driveway': 'Driveway Cleaning',
    'house-washing': 'House Washing',
    'house': 'House Washing',
    'patio-cleaning': 'Patio Cleaning',
    'patio': 'Patio Cleaning',
    'gutter-cleaning': 'Gutter Cleaning',
    'gutter': 'Gutter Cleaning',
    'pressure-washing': 'Pressure Washing'
  };

  const cityMappings: Record<string, string> = {
    'port-moody': 'Port Moody',
    'coquitlam': 'Coquitlam',
    'port-coquitlam': 'Port Coquitlam',
    'burnaby': 'Burnaby',
    'vancouver': 'Vancouver',
    'north-vancouver': 'North Vancouver',
    'west-vancouver': 'West Vancouver',
    'seattle': 'Seattle'
  };

  const slug = landingPath.replace(/^\//, '').toLowerCase();

  let service = '';
  let city = '';

  // 1. Try to find city first as a suffix
  for (const [citySlug, cityName] of Object.entries(cityMappings)) {
    if (slug.endsWith(`-${citySlug}`)) {
      city = cityName;
      const rest = slug.slice(0, -(citySlug.length + 1));
      if (serviceMappings[rest]) {
        service = serviceMappings[rest];
      } else {
        service = rest
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
      break;
    }
  }

  // 2. If no city suffix found, check if it exact matches a service mapping
  if (!service && !city) {
    if (serviceMappings[slug]) {
      service = serviceMappings[slug];
    } else if (cityMappings[slug]) {
      city = cityMappings[slug];
    } else {
      // 3. Fallback: try to see if slug contains city anywhere inside
      for (const [citySlug, cityName] of Object.entries(cityMappings)) {
        if (slug.includes(citySlug)) {
          city = cityName;
          const rest = slug.replace(citySlug, '').replace(/^-+|-+$/g, '').replace(/--+/g, '-');
          if (serviceMappings[rest]) {
            service = serviceMappings[rest];
          } else if (rest) {
            service = rest
              .split('-')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
          }
          break;
        }
      }
    }
  }

  // If still no service/city found but slug has hyphens, and no city resolved, format slug as service
  if (!service && !city) {
    service = slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const pageType = detectPageType(landingPath, service, city);

  return {
    source_page: cleanPath,
    source_page_type: pageType,
    source_service: service,
    source_city: city,
    landing_page: cleanPath
  };
}
