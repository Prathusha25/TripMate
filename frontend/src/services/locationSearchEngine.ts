import axios from 'axios';
import { LocationResult } from '../types';

export interface CatalogDestination {
  name: string;
  region: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population?: number;
  feature_code?: string;
  popularity: number;
  aliases: string[];
}

export const POPULAR_DESTINATIONS: CatalogDestination[] = [
  // Top Indian Destinations & Tourist Hubs
  { name: "Goa", region: "Goa", country: "India", country_code: "IN", latitude: 15.2993, longitude: 74.1240, timezone: "Asia/Kolkata", population: 1500000, feature_code: "ADM1", popularity: 100, aliases: ["goa", "gao", "panaji", "north goa", "south goa", "goa india"] },
  { name: "Manali", region: "Himachal Pradesh", country: "India", country_code: "IN", latitude: 32.2396, longitude: 77.1887, timezone: "Asia/Kolkata", population: 8096, feature_code: "PPL", popularity: 95, aliases: ["manali", "kullu manali", "manali himachal"] },
  { name: "Munnar", region: "Kerala", country: "India", country_code: "IN", latitude: 10.0889, longitude: 77.0595, timezone: "Asia/Kolkata", population: 32000, feature_code: "PPL", popularity: 92, aliases: ["munnar", "munar", "munnar kerala"] },
  { name: "Ooty", region: "Tamil Nadu", country: "India", country_code: "IN", latitude: 11.4102, longitude: 76.6950, timezone: "Asia/Kolkata", population: 88430, feature_code: "PPL", popularity: 90, aliases: ["ooty", "udhagamandalam", "oti"] },
  { name: "Darjeeling", region: "West Bengal", country: "India", country_code: "IN", latitude: 27.0410, longitude: 88.2663, timezone: "Asia/Kolkata", population: 118805, feature_code: "PPL", popularity: 90, aliases: ["darjeeling", "darjeling", "darjiling"] },
  { name: "Srinagar", region: "Jammu and Kashmir", country: "India", country_code: "IN", latitude: 34.0837, longitude: 74.7973, timezone: "Asia/Kolkata", population: 1180570, feature_code: "PPLA", popularity: 92, aliases: ["srinagar", "kashmir", "shrinagar"] },
  { name: "Jaipur", region: "Rajasthan", country: "India", country_code: "IN", latitude: 26.9124, longitude: 75.7873, timezone: "Asia/Kolkata", population: 3073350, feature_code: "PPLA", popularity: 95, aliases: ["jaipur", "pink city"] },
  { name: "Bengaluru", region: "Karnataka", country: "India", country_code: "IN", latitude: 12.9716, longitude: 77.5946, timezone: "Asia/Kolkata", population: 8443675, feature_code: "PPLA", popularity: 96, aliases: ["bengaluru", "bangalore", "banglore", "bangluru", "blr"] },
  { name: "Mumbai", region: "Maharashtra", country: "India", country_code: "IN", latitude: 19.0760, longitude: 72.8777, timezone: "Asia/Kolkata", population: 12442373, feature_code: "PPLA", popularity: 98, aliases: ["mumbai", "bombay", "mumabi", "mumbay"] },
  { name: "Delhi", region: "Delhi", country: "India", country_code: "IN", latitude: 28.6139, longitude: 77.2090, timezone: "Asia/Kolkata", population: 16787941, feature_code: "PPLC", popularity: 98, aliases: ["delhi", "new delhi", "delh", "dilli"] },
  { name: "Hyderabad", region: "Telangana", country: "India", country_code: "IN", latitude: 17.3850, longitude: 78.4867, timezone: "Asia/Kolkata", population: 6809970, feature_code: "PPLA", popularity: 96, aliases: ["hyderabad", "hydrabad", "hyderbad", "secunderabad", "hyd"] },
  { name: "Kolkata", region: "West Bengal", country: "India", country_code: "IN", latitude: 22.5726, longitude: 88.3639, timezone: "Asia/Kolkata", population: 4496694, feature_code: "PPLA", popularity: 92, aliases: ["kolkata", "calcutta", "kolkatta"] },
  { name: "Chennai", region: "Tamil Nadu", country: "India", country_code: "IN", latitude: 13.0827, longitude: 80.2707, timezone: "Asia/Kolkata", population: 7088000, feature_code: "PPLA", popularity: 92, aliases: ["chennai", "madras", "chenai"] },
  { name: "Varanasi", region: "Uttar Pradesh", country: "India", country_code: "IN", latitude: 25.3176, longitude: 82.9739, timezone: "Asia/Kolkata", population: 1198491, feature_code: "PPL", popularity: 94, aliases: ["varanasi", "banaras", "kashi", "benaras"] },
  { name: "Agra", region: "Uttar Pradesh", country: "India", country_code: "IN", latitude: 27.1767, longitude: 78.0081, timezone: "Asia/Kolkata", population: 1585704, feature_code: "PPL", popularity: 94, aliases: ["agra", "taj mahal"] },
  { name: "Udaipur", region: "Rajasthan", country: "India", country_code: "IN", latitude: 24.5854, longitude: 73.7125, timezone: "Asia/Kolkata", population: 451100, feature_code: "PPL", popularity: 92, aliases: ["udaipur", "city of lakes"] },
  { name: "Rishikesh", region: "Uttarakhand", country: "India", country_code: "IN", latitude: 30.0869, longitude: 78.2676, timezone: "Asia/Kolkata", population: 102138, feature_code: "PPL", popularity: 90, aliases: ["rishikesh", "hrishikesh"] },
  { name: "Shimla", region: "Himachal Pradesh", country: "India", country_code: "IN", latitude: 31.1048, longitude: 77.1734, timezone: "Asia/Kolkata", population: 169578, feature_code: "PPLA", popularity: 90, aliases: ["shimla", "simla"] },
  { name: "Leh", region: "Ladakh", country: "India", country_code: "IN", latitude: 34.1526, longitude: 77.5771, timezone: "Asia/Kolkata", population: 30870, feature_code: "PPLA", popularity: 92, aliases: ["leh", "ladakh", "leh ladakh"] },
  { name: "Visakhapatnam", region: "Andhra Pradesh", country: "India", country_code: "IN", latitude: 17.6868, longitude: 83.2185, timezone: "Asia/Kolkata", population: 2035922, feature_code: "PPLA", popularity: 88, aliases: ["visakhapatnam", "vizag", "vishakapatnam"] },
  { name: "Tirupati", region: "Andhra Pradesh", country: "India", country_code: "IN", latitude: 13.6288, longitude: 79.4192, timezone: "Asia/Kolkata", population: 287482, feature_code: "PPL", popularity: 88, aliases: ["tirupati", "tirupathi", "tirumala"] },
  { name: "Araku Valley", region: "Andhra Pradesh", country: "India", country_code: "IN", latitude: 18.3273, longitude: 82.8775, timezone: "Asia/Kolkata", population: 5000, feature_code: "PPL", popularity: 85, aliases: ["araku", "araku valley"] },
  { name: "Pondicherry", region: "Puducherry", country: "India", country_code: "IN", latitude: 11.9416, longitude: 79.8083, timezone: "Asia/Kolkata", population: 244377, feature_code: "PPLA", popularity: 90, aliases: ["pondicherry", "puducherry", "pondy"] },
  { name: "Coorg", region: "Karnataka", country: "India", country_code: "IN", latitude: 12.3375, longitude: 75.8069, timezone: "Asia/Kolkata", population: 32286, feature_code: "PPL", popularity: 89, aliases: ["coorg", "kodagu", "madikeri"] },
  { name: "Alleppey", region: "Kerala", country: "India", country_code: "IN", latitude: 9.4981, longitude: 76.3388, timezone: "Asia/Kolkata", population: 174164, feature_code: "PPL", popularity: 91, aliases: ["alleppey", "alappuzha"] },
  { name: "Hampi", region: "Karnataka", country: "India", country_code: "IN", latitude: 15.3350, longitude: 76.4600, timezone: "Asia/Kolkata", population: 2777, feature_code: "PPL", popularity: 90, aliases: ["hampi"] },

  // Top International Travel Hubs
  { name: "Paris", region: "Île-de-France", country: "France", country_code: "FR", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris", population: 2161000, feature_code: "PPLC", popularity: 100, aliases: ["paris", "pari"] },
  { name: "London", region: "England", country: "United Kingdom", country_code: "GB", latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London", population: 8982000, feature_code: "PPLC", popularity: 100, aliases: ["london", "londres"] },
  { name: "New York", region: "New York", country: "United States", country_code: "US", latitude: 40.7128, longitude: -74.0060, timezone: "America/New_York", population: 8804190, feature_code: "PPL", popularity: 100, aliases: ["new york", "nyc", "new york city"] },
  { name: "Dubai", region: "Dubai", country: "United Arab Emirates", country_code: "AE", latitude: 25.2048, longitude: 55.2708, timezone: "Asia/Dubai", population: 3331420, feature_code: "PPLA", popularity: 98, aliases: ["dubai", "dxb"] },
  { name: "Tokyo", region: "Tokyo", country: "Japan", country_code: "JP", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo", population: 13960000, feature_code: "PPLC", popularity: 100, aliases: ["tokyo", "tokio"] },
  { name: "Rome", region: "Lazio", country: "Italy", country_code: "IT", latitude: 41.9028, longitude: 12.4964, timezone: "Europe/Rome", population: 2873000, feature_code: "PPLC", popularity: 97, aliases: ["rome", "roma"] },
  { name: "Barcelona", region: "Catalonia", country: "Spain", country_code: "ES", latitude: 41.3879, longitude: 2.1699, timezone: "Europe/Madrid", population: 1620343, feature_code: "PPLA", popularity: 97, aliases: ["barcelona", "bcn"] },
  { name: "Bali", region: "Bali", country: "Indonesia", country_code: "ID", latitude: -8.4095, longitude: 115.1889, timezone: "Asia/Makassar", population: 4362000, feature_code: "ADM1", popularity: 98, aliases: ["bali", "denpasar", "ubud"] },
  { name: "Bangkok", region: "Bangkok", country: "Thailand", country_code: "TH", latitude: 13.7563, longitude: 100.5018, timezone: "Asia/Bangkok", population: 10539000, feature_code: "PPLC", popularity: 98, aliases: ["bangkok", "bkk"] },
  { name: "Singapore", region: "Singapore", country: "Singapore", country_code: "SG", latitude: 1.3521, longitude: 103.8198, timezone: "Asia/Singapore", population: 5686000, feature_code: "PPLC", popularity: 98, aliases: ["singapore", "singapur"] },
  { name: "Amsterdam", region: "North Holland", country: "Netherlands", country_code: "NL", latitude: 52.3676, longitude: 4.9041, timezone: "Europe/Amsterdam", population: 872680, feature_code: "PPLC", popularity: 96, aliases: ["amsterdam", "ams"] },
  { name: "Sydney", region: "New South Wales", country: "Australia", country_code: "AU", latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney", population: 5312000, feature_code: "PPLA", popularity: 96, aliases: ["sydney", "syd"] },
  { name: "Cairo", region: "Cairo", country: "Egypt", country_code: "EG", latitude: 30.0444, longitude: 31.2357, timezone: "Africa/Cairo", population: 9500000, feature_code: "PPLC", popularity: 94, aliases: ["cairo", "al qahirah"] },
  { name: "Istanbul", region: "Istanbul", country: "Turkey", country_code: "TR", latitude: 41.0082, longitude: 28.9784, timezone: "Europe/Istanbul", population: 15460000, feature_code: "PPLA", popularity: 96, aliases: ["istanbul", "constantinople"] },
];

/**
 * Calculates Damerau-Levenshtein distance (insertions, deletions, substitutions, transpositions).
 */
export function damerauLevenshtein(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  const len1 = str1.length;
  const len2 = str2.length;
  const d: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && str1[i - 1] === str2[j - 2] && str1[i - 2] === str2[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost); // transposition
      }
    }
  }

  return d[len1][len2];
}

/**
 * Computes normalized similarity between 0.0 and 1.0.
 */
export function stringSimilarity(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (!q || !t) return 0.0;
  if (q === t) return 1.0;
  if (t.startsWith(q)) return 0.92 - (t.length - q.length) * 0.01;
  if (q.startsWith(t)) return 0.88;
  if (t.includes(q)) return 0.82;

  const maxLen = Math.max(q.length, t.length);
  const dist = damerauLevenshtein(q, t);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Calculates a comprehensive travel relevance score for a location candidate.
 */
export function calculateLocationScore(query: string, item: LocationResult): number {
  const q = query.toLowerCase().trim();
  const name = item.name.toLowerCase();
  const region = (item.region || '').toLowerCase();
  const country = item.country.toLowerCase();
  const population = item.population || 0;
  const feature = item.feature_code || '';

  // 1. Text Similarity Score (0 - 100)
  const simName = stringSimilarity(q, item.name);
  const dist = damerauLevenshtein(q, name);
  let textScore = 0;

  if (q === name) {
    textScore = 100.0;
  } else if (dist === 1 && q.length <= 4) {
    // e.g. "gao" vs "goa"
    textScore = 90.0;
  } else if (dist <= 2) {
    textScore = Math.max(simName * 85.0, 75.0);
  } else {
    textScore = simName * 80.0;
  }

  if (region.includes(q) || country.includes(q)) {
    textScore = Math.max(textScore, 65.0);
  }

  // 2. Travel Hub / Popularity Boost (0 - 45)
  let travelBoost = 0.0;
  for (const dest of POPULAR_DESTINATIONS) {
    if (dest.name.toLowerCase() === name) {
      if (Math.abs(dest.latitude - item.latitude) < 1.0 && Math.abs(dest.longitude - item.longitude) < 1.0) {
        travelBoost = (dest.popularity || 90) * 0.45;
        break;
      }
    }
  }

  // 3. Population Weight (0 - 25)
  let popScore = 0.0;
  if (population > 5000000) popScore = 25.0;
  else if (population > 1000000) popScore = 20.0;
  else if (population > 100000) popScore = 14.0;
  else if (population > 10000) popScore = 8.0;

  // 4. Feature Code Boost (0 - 15)
  let featureScore = 0.0;
  if (['PPLC', 'PPLA', 'ADM1'].includes(feature)) featureScore = 15.0;
  else if (['PPL', 'ADM2'].includes(feature)) featureScore = 8.0;

  // 5. Penalty for obscure exact match when query is a known travel typo
  let penalty = 0.0;
  if (dist === 0 && travelBoost === 0 && popScore < 5) {
    penalty = 15.0;
  }

  return textScore + travelBoost + popScore + featureScore - penalty;
}

/**
 * Searches and ranks destinations using multi-query Open-Meteo fetching + catalog matching.
 */
export async function searchAndRankDestinations(query: string, limit = 10): Promise<LocationResult[]> {
  if (!query || query.trim().length < 2) return [];

  const rawQuery = query.trim();
  const cleanQ = rawQuery.toLowerCase();

  // 1. Identify matching candidates from curated catalog
  const catalogCandidates: { dest: CatalogDestination; sim: number }[] = [];
  for (const dest of POPULAR_DESTINATIONS) {
    let bestSim = stringSimilarity(cleanQ, dest.name);
    for (const alias of dest.aliases) {
      const simAlias = stringSimilarity(cleanQ, alias);
      if (simAlias > bestSim) bestSim = simAlias;
    }
    const dist = damerauLevenshtein(cleanQ, dest.name.toLowerCase());
    if (bestSim >= 0.70 || dist <= 2 || dest.name.toLowerCase().includes(cleanQ)) {
      catalogCandidates.push({ dest, sim: Math.max(bestSim, dist <= 1 ? 0.85 : 0.65) });
    }
  }
  catalogCandidates.sort((a, b) => b.sim - a.sim);

  // 2. Prepare multi-query search terms
  const searchTerms = new Set<string>([rawQuery]);
  for (const c of catalogCandidates.slice(0, 3)) {
    searchTerms.add(c.dest.name);
  }

  // 3. Fetch from Open-Meteo for all search terms
  const allResults: LocationResult[] = [];

  // Directly inject matching catalog destinations as verified candidates
  for (const c of catalogCandidates) {
    if (c.sim >= 0.65) {
      allResults.push({
        name: c.dest.name,
        latitude: c.dest.latitude,
        longitude: c.dest.longitude,
        country: c.dest.country,
        country_code: c.dest.country_code,
        region: c.dest.region,
        timezone: c.dest.timezone,
        population: c.dest.population,
        feature_code: c.dest.feature_code
      });
    }
  }

  // Query Open-Meteo in parallel
  const fetchPromises = Array.from(searchTerms).map(async (term) => {
    try {
      const res = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=8&language=en&format=json`,
        { timeout: 5000 }
      );
      const results: LocationResult[] = (res.data?.results || []).map((r: any) => ({
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        country: r.country || '',
        country_code: r.country_code || '',
        region: r.admin1 || r.admin2 || '',
        timezone: r.timezone || 'UTC',
        population: r.population,
        feature_code: r.feature_code
      }));
      return results;
    } catch {
      return [];
    }
  });

  const responses = await Promise.all(fetchPromises);
  responses.forEach((res) => allResults.push(...res));

  // 4. Deduplicate results
  const deduped: LocationResult[] = [];
  const seen = new Set<string>();
  for (const item of allResults) {
    const key = `${item.name.toLowerCase()}|${(item.country || '').toLowerCase()}|${item.latitude.toFixed(2)}|${item.longitude.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  // 5. Rank results using the scoring formula
  deduped.sort((a, b) => calculateLocationScore(rawQuery, b) - calculateLocationScore(rawQuery, a));

  return deduped.slice(0, limit);
}
