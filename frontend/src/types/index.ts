export interface User {
  id: string;
  email: string;
  name: string;
  profile_photo: string | null;
  bio: string | null;
  home_city: string | null;
  interests: string[];
  travel_style: string[];
  budget_preference: string | null;
  role?: string;
  created_at: string;
}

export interface UserMini {
  id: string;
  name: string;
  profile_photo: string | null;
  bio: string | null;
  interests: string[];
  travel_style: string[];
}

export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string; // ISO Date YYYY-MM-DD
  end_date: string; // ISO Date YYYY-MM-DD
  approximate_budget: number;
  travel_interests: string[];
  preferred_travel_style: string[];
  number_of_travelers: number;
  description: string | null;
  created_at: string;
  members?: string[];
  owner_name?: string | null;
  owner_profile_photo?: string | null;
  owner_bio?: string | null;
  members_profiles?: UserMini[];
}

export interface TripMini {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  approximate_budget: number;
  description: string | null;
}

export interface DiscoveryCard {
  id: string; // Trip ID
  destination: string;
  start_date: string;
  end_date: string;
  approximate_budget: number;
  travel_interests: string[];
  preferred_travel_style: string[];
  number_of_travelers: number;
  description: string | null;
  user: UserMini;
  compatibility: string;
  match_score?: number;
  match_tier?: string;
  match_reasons?: string[];
  match_differences?: string[];
  match_method?: string;
  features?: Record<string, number>;
}

export interface TravelRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  trip_id?: string;
  request_type?: 'trip_join' | 'buddy_request';
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  sender?: UserMini;
  receiver?: UserMini;
  trip?: TripMini;
}

export interface Connection {
  id: string;
  user1_id: string;
  user2_id: string;
  trip_id: string;
  created_at: string;
  buddy: UserMini;
  shared_trip: TripMini;
}

export interface Message {
  id: string;
  connection_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  is_read: boolean;
}

export interface LocationResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code?: string;
  region?: string;
  timezone: string;
  population?: number;
  feature_code?: string;
}

