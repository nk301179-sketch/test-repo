import axios from 'axios';

const GEONAMES_USERNAME = 'chaturnak'; // TODO: Replace with a valid GeoNames username
const GEONAMES_BASE_URL = 'https://secure.geonames.org';
const RESTCOUNTRIES_URL = 'https://restcountries.com/v3.1/all';
const STATES_DATA_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/states.json';

// Public, free geocoding endpoint (no API key required).
// NOTE: Intended for light usage – for production/high-traffic, consider a paid geocoding provider.
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

export interface Country {
  countryCode: string;
  countryName: string;
  dialCode?: string;
}

export interface Subdivision {
  code: string;
  name: string;
}

export interface LocationSuggestion {
  id: string;
  displayName: string;
  city?: string;
  state?: string;
  country?: string;
  lat: number;
  lon: number;
}

interface GeoNamesCountry {
  countryCode: string;
  countryName: string;
}

interface RestCountry {
  cca2: string;
  name: {
    common: string;
  };
  idd?: {
    root?: string;
    suffixes?: string[];
  };
}

const normalizeCountries = (countries: Country[]): Country[] =>
  [...countries].sort((a, b) => a.countryName.localeCompare(b.countryName));

const fetchCountriesFromGeoNames = async (): Promise<Country[]> => {
  const response = await axios.get(`${GEONAMES_BASE_URL}/countryInfoJSON`, {
    params: {
      username: GEONAMES_USERNAME,
    },
  });

  if (!response.data?.geonames) {
    return [];
  }

  return normalizeCountries(
    (response.data.geonames as GeoNamesCountry[])
      .filter((country) => Boolean(country?.countryCode && country?.countryName))
      .map((country) => ({
        countryCode: country.countryCode,
        countryName: country.countryName,
        dialCode: '',
      }))
  );
};

const fetchCountriesFromRestCountries = async (): Promise<Country[]> => {
  const response = await axios.get<RestCountry[]>(RESTCOUNTRIES_URL, {
    params: {
      fields: 'name,cca2,idd',
    },
  });

  if (!Array.isArray(response.data)) {
    return [];
  }

  return normalizeCountries(
    response.data
      .filter((country) => Boolean(country?.cca2 && country?.name?.common))
      .map((country) => ({
        countryCode: country.cca2,
        countryName: country.name.common,
        dialCode: `${country?.idd?.root ?? ''}${country?.idd?.suffixes?.[0] ?? ''}`.trim(),
      }))
  );
};

export const fetchCountries = async (): Promise<Country[]> => {
  const sources = [
    { name: 'REST Countries', fetcher: fetchCountriesFromRestCountries },
    { name: 'GeoNames', fetcher: fetchCountriesFromGeoNames },
  ];

  for (const source of sources) {
    try {
      const countries = await source.fetcher();
      if (countries.length) {
        return countries;
      }
    } catch (error) {
      console.warn(`Error fetching countries from ${source.name}:`, error);
    }
  }

  return [];
};

interface RawStateData {
  country_code?: string;
  iso2?: string;
  iso3166_2?: string;
  name: string;
}

let statesDataPromise: Promise<RawStateData[]> | null = null;

const loadStatesData = async (): Promise<RawStateData[]> => {
  if (!statesDataPromise) {
    statesDataPromise = axios
      .get(STATES_DATA_URL)
      .then((response) => response.data)
      .catch((error) => {
        statesDataPromise = null;
        throw error;
      });
  }
  return statesDataPromise;
};

const normalizeSubdivisions = (subdivisions: Subdivision[]): Subdivision[] =>
  [...subdivisions].sort((a, b) => a.name.localeCompare(b.name));

export const fetchSubdivisionsByCountryCode = async (countryCode: string): Promise<Subdivision[]> => {
  if (!countryCode) {
    return [];
  }

  try {
    const rawStates = await loadStatesData();
    const upperCountryCode = countryCode.toUpperCase();
    const subdivisions = rawStates
      .filter((state) => state.country_code?.toUpperCase() === upperCountryCode)
      .map((state) => ({
        code: state.iso3166_2 || state.iso2 || state.name,
        name: state.name,
      }));

    return normalizeSubdivisions(subdivisions);
  } catch (error) {
    console.warn('Error fetching subdivisions data:', error);
    return [];
  }
};

interface NominatimResult {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

export const fetchLocationSuggestions = async (query: string): Promise<LocationSuggestion[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  try {
    const response = await axios.get<NominatimResult[]>(NOMINATIM_SEARCH_URL, {
      params: {
        q: trimmed,
        format: 'json',
        addressdetails: 1,
        limit: 8,
      },
      headers: {
        // Helps Nominatim identify the application – recommended by their usage policy
        'Accept-Language': 'en',
      },
    });

    if (!Array.isArray(response.data)) {
      return [];
    }

    return response.data.map((result, index) => {
      const cityLike =
        result.address?.city ||
        result.address?.town ||
        result.address?.village ||
        undefined;

      const country = result.address?.country;
      const state = result.address?.state;

      const parts: string[] = [];
      if (cityLike) parts.push(cityLike);
      if (state && state !== cityLike) parts.push(state);
      if (country) parts.push(country);

      const displayName = parts.length ? parts.join(', ') : result.display_name;

      return {
        id: String(result.place_id ?? `${displayName}-${index}`),
        displayName,
        city: cityLike,
        state,
        country,
        lat: Number(result.lat),
        lon: Number(result.lon),
      };
    });
  } catch (error) {
    console.warn('Error fetching location suggestions:', error);
    return [];
  }
};

