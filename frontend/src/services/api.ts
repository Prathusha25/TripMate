import axios from 'axios';
import { INITIAL_USERS, INITIAL_TRIPS, INITIAL_REQUESTS, INITIAL_CONNECTIONS, INITIAL_MESSAGES, COMPANION_REPLIES } from '../data/mockData';
import { User, Trip, TravelRequest, Connection, Message, DiscoveryCard, UserMini, TripMini, LocationResult } from '../types';
import { searchAndRankDestinations } from './locationSearchEngine';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCK = true; // Enabled for instant out-of-the-box browser execution (uses real Open-Meteo Geocoding)

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tripmate_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiry / auth failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('tripmate_token');
      const path = window.location.pathname;
      if (path !== '/' && path !== '/login' && path !== '/signup') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

// ==========================================
// LOCAL STORAGE MOCK DATABASE IMPLEMENTATION
// ==========================================

const seedMockDatabase = () => {
  if (!localStorage.getItem('tripmate_db_seeded')) {
    localStorage.setItem('tripmate_users', JSON.stringify(INITIAL_USERS));
    localStorage.setItem('tripmate_trips', JSON.stringify(INITIAL_TRIPS));
    localStorage.setItem('tripmate_requests', JSON.stringify(INITIAL_REQUESTS));
    localStorage.setItem('tripmate_connections', JSON.stringify(INITIAL_CONNECTIONS));
    localStorage.setItem('tripmate_messages', JSON.stringify(INITIAL_MESSAGES));
    localStorage.setItem('tripmate_db_seeded', 'true');
  }
};

const getFromDB = <T>(key: string): T[] => {
  seedMockDatabase();
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveToDB = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const getCurrentMockUser = (): User => {
  const token = localStorage.getItem('tripmate_token');
  if (!token || !token.startsWith('mock_token_')) {
    throw { response: { status: 401, data: { detail: 'Unauthorized' } } };
  }
  const userId = token.replace('mock_token_', '');
  const users = getFromDB<User>('tripmate_users');
  const user = users.find((u) => u.id === userId);
  if (!user) {
    throw { response: { status: 401, data: { detail: 'User not found' } } };
  }
  return user;
};

// Simulate API delay
const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// SERVICES DEFINITIONS
// ==========================================

export const authService = {
  async signup(data: any) {
    if (USE_MOCK) {
      await delay(600);
      const users = getFromDB<User>('tripmate_users');
      if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
        throw { response: { data: { detail: 'Email already registered' } } };
      }
      
      const newUser: User = {
        id: 'u_' + Date.now(),
        email: data.email,
        name: data.name,
        profile_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200', // Default modern avatar
        bio: '',
        home_city: '',
        interests: [],
        travel_style: [],
        budget_preference: 'Moderate',
        created_at: new Date().toISOString(),
      };

      users.push(newUser);
      saveToDB('tripmate_users', users);
      return { access_token: `mock_token_${newUser.id}`, token_type: 'bearer' };
    } else {
      const res = await api.post('/auth/signup', data);
      return res.data;
    }
  },

  async login(data: any) {
    if (USE_MOCK) {
      await delay(500);
      const users = getFromDB<User>('tripmate_users');
      const user = users.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
      if (!user) {
        throw { response: { data: { detail: 'Incorrect email or password' } } };
      }
      return { access_token: `mock_token_${user.id}`, token_type: 'bearer' };
    } else {
      const res = await api.post('/auth/login', data);
      return res.data;
    }
  },

  async getMe() {
    if (USE_MOCK) {
      await delay(200);
      return getCurrentMockUser();
    } else {
      const res = await api.get('/auth/me');
      return res.data;
    }
  },

  async verifyCode(email: string, code: string) {
    if (USE_MOCK) {
      await delay(400);
      return { access_token: 'mock_token_123456', token_type: 'bearer' };
    } else {
      const res = await api.post('/auth/verify', { email, code });
      return res.data;
    }
  },

  async resendCode(email: string) {
    if (USE_MOCK) {
      await delay(300);
      return { status: 'sent' };
    } else {
      const res = await api.post('/auth/resend-code', { email });
      return res.data;
    }
  },
};

export const userService = {
  async getProfile() {
    if (USE_MOCK) {
      await delay(200);
      return getCurrentMockUser();
    } else {
      const res = await api.get('/users/me');
      return res.data;
    }
  },

  async getUserProfile(userId: string) {
    if (USE_MOCK) {
      await delay(250);
      const users = getFromDB<User>('tripmate_users');
      const user = users.find((u) => u.id === userId);
      if (!user) throw { response: { status: 404, data: { detail: 'User not found' } } };
      return user;
    } else {
      const res = await api.get(`/users/${userId}`);
      return res.data;
    }
  },

  async updateProfile(data: any) {
    if (USE_MOCK) {
      await delay(400);
      const currentUser = getCurrentMockUser();
      const users = getFromDB<User>('tripmate_users');
      
      const updatedUsers = users.map((u) => {
        if (u.id === currentUser.id) {
          return {
            ...u,
            name: data.name ?? u.name,
            profile_photo: data.profile_photo ?? u.profile_photo,
            bio: data.bio ?? u.bio,
            home_city: data.home_city ?? u.home_city,
            interests: data.interests ?? u.interests,
            travel_style: data.travel_style ?? u.travel_style,
            budget_preference: data.budget_preference ?? u.budget_preference,
          };
        }
        return u;
      });

      saveToDB('tripmate_users', updatedUsers);
      return updatedUsers.find((u) => u.id === currentUser.id);
    } else {
      const res = await api.put('/users/me', data);
      return res.data;
    }
  },
};

export const tripService = {
  async getTrips() {
    if (USE_MOCK) {
      await delay(300);
      const currentUser = getCurrentMockUser();
      const trips = getFromDB<Trip>('tripmate_trips');
      return trips.filter((t) => t.user_id === currentUser.id);
    } else {
      const res = await api.get('/trips');
      return res.data;
    }
  },

  async getTrip(tripId: string) {
    if (USE_MOCK) {
      await delay(250);
      const trips = getFromDB<Trip>('tripmate_trips');
      const trip = trips.find((t) => t.id === tripId);
      if (!trip) throw { response: { status: 404, data: { detail: 'Trip not found' } } };
      return trip;
    } else {
      const res = await api.get(`/trips/${tripId}`);
      return res.data;
    }
  },

  async createTrip(data: any) {
    if (USE_MOCK) {
      await delay(400);
      const currentUser = getCurrentMockUser();
      const trips = getFromDB<Trip>('tripmate_trips');
      
      const newTrip: Trip = {
        id: 't_' + Date.now(),
        user_id: currentUser.id,
        destination: data.destination,
        start_date: data.start_date,
        end_date: data.end_date,
        approximate_budget: Number(data.approximate_budget),
        travel_interests: data.travel_interests || [],
        preferred_travel_style: data.preferred_travel_style || [],
        number_of_travelers: Number(data.number_of_travelers || 1),
        description: data.description || null,
        created_at: new Date().toISOString(),
      };

      trips.push(newTrip);
      saveToDB('tripmate_trips', trips);
      return newTrip;
    } else {
      const res = await api.post('/trips', data);
      return res.data;
    }
  },

  async updateTrip(tripId: string, data: any) {
    if (USE_MOCK) {
      await delay(400);
      const trips = getFromDB<Trip>('tripmate_trips');
      const tripIdx = trips.findIndex((t) => t.id === tripId);
      if (tripIdx === -1) throw { response: { status: 404, data: { detail: 'Trip not found' } } };
      
      const updatedTrip = {
        ...trips[tripIdx],
        destination: data.destination ?? trips[tripIdx].destination,
        start_date: data.start_date ?? trips[tripIdx].start_date,
        end_date: data.end_date ?? trips[tripIdx].end_date,
        approximate_budget: data.approximate_budget ? Number(data.approximate_budget) : trips[tripIdx].approximate_budget,
        travel_interests: data.travel_interests ?? trips[tripIdx].travel_interests,
        preferred_travel_style: data.preferred_travel_style ?? trips[tripIdx].preferred_travel_style,
        number_of_travelers: data.number_of_travelers ? Number(data.number_of_travelers) : trips[tripIdx].number_of_travelers,
        description: data.description ?? trips[tripIdx].description,
      };

      trips[tripIdx] = updatedTrip;
      saveToDB('tripmate_trips', trips);
      return updatedTrip;
    } else {
      const res = await api.put(`/trips/${tripId}`, data);
      return res.data;
    }
  },

  async deleteTrip(tripId: string) {
    if (USE_MOCK) {
      await delay(300);
      const trips = getFromDB<Trip>('tripmate_trips');
      const filtered = trips.filter((t) => t.id !== tripId);
      saveToDB('tripmate_trips', filtered);
      return { success: true };
    } else {
      const res = await api.delete(`/trips/${tripId}`);
      return res.data;
    }
  },
};

export const discoveryService = {
  async getPublicTrips() {
    if (USE_MOCK) {
      await delay(400);
      const trips = getFromDB<Trip>('tripmate_trips');
      const users = getFromDB<User>('tripmate_users');
      const currentUser = getCurrentMockUser();
      const otherTrips = trips.filter((t) => t.user_id !== currentUser.id);
      return otherTrips.map(trip => {
        const owner = users.find(u => u.id === trip.user_id);
        return {
          ...trip,
          owner_name: owner?.name || 'Traveler',
          owner_profile_photo: owner?.profile_photo || null,
          owner_bio: owner?.bio || null,
        };
      });
    } else {
      const res = await api.get('/trips/public');
      return res.data;
    }
  },

  async getTravelBuddies() {
    if (USE_MOCK) {
      await delay(400);
      const currentUser = getCurrentMockUser();
      const trips = getFromDB<Trip>('tripmate_trips');
      const users = getFromDB<User>('tripmate_users');
      
      const myTrips = trips.filter((t) => t.user_id === currentUser.id);
      const otherTrips = trips.filter((t) => t.user_id !== currentUser.id);

      const BUDGET_TIERS: Record<string, number> = { 'budget': 0, 'moderate': 1, 'premium': 2, 'luxury': 3 };
      const getBudgetTier = (val: any) => {
        if (typeof val === 'string') return BUDGET_TIERS[val.toLowerCase()] ?? 1;
        const num = Number(val);
        if (isNaN(num)) return 1;
        if (num <= 400) return 0;
        if (num <= 1000) return 1;
        if (num <= 2500) return 2;
        return 3;
      };

      const getJaccard = (arr1: string[], arr2: string[]) => {
        const s1 = new Set(arr1 || []);
        const s2 = new Set(arr2 || []);
        const intersect = new Set([...s1].filter(x => s2.has(x)));
        const union = new Set([...s1, ...s2]);
        return union.size > 0 ? intersect.size / union.size : 0;
      };
      
      const discoveryCards: DiscoveryCard[] = otherTrips.map((trip) => {
        const tripCreator = users.find((u) => u.id === trip.user_id) || users[0];
        const userMini: UserMini = {
          id: tripCreator.id,
          name: tripCreator.name,
          profile_photo: tripCreator.profile_photo,
          bio: tripCreator.bio,
          interests: tripCreator.interests,
          travel_style: tripCreator.travel_style,
        };

        // Calculate score
        let bestScore = 0;
        let reasons: string[] = [];
        
        if (myTrips.length > 0) {
          for (const myTrip of myTrips) {
            let score = 0;
            const currentReasons: string[] = [];
            
            // 1. Destination
            const destA = myTrip.destination.split(',')[0].trim().toLowerCase();
            const destB = trip.destination.split(',')[0].trim().toLowerCase();
            let destMatch = 0;
            if (destA === destB) {
              destMatch = 1;
              currentReasons.push("Same destination");
            }

            // 2. Dates
            const startA = new Date(myTrip.start_date);
            const endA = new Date(myTrip.end_date);
            const startB = new Date(trip.start_date);
            const endB = new Date(trip.end_date);
            const overlapDays = Math.max(0, (Math.min(endA.getTime(), endB.getTime()) - Math.max(startA.getTime(), startB.getTime())) / (1000 * 60 * 60 * 24) + 1);
            const durationA = Math.max(1, (endA.getTime() - startA.getTime()) / (1000 * 60 * 60 * 24) + 1);
            const dateOverlap = Math.min(1.0, overlapDays / durationA);

            if (dateOverlap > 0.9) currentReasons.push("Dates overlap completely");
            else if (dateOverlap > 0.3) currentReasons.push("Dates overlap partially");

            // 3. Interests
            const intSim = getJaccard(currentUser.interests, tripCreator.interests);
            const sharedInts = (currentUser.interests || []).filter(x => (tripCreator.interests || []).includes(x));
            if (sharedInts.length > 0) {
              currentReasons.push(`Shared interests: ${sharedInts.slice(0, 3).join(', ')}`);
            }

            // 4. Budget
            const tierA = getBudgetTier(myTrip.approximate_budget);
            const tierB = getBudgetTier(trip.approximate_budget);
            const diff = Math.abs(tierA - tierB);
            const budgetSim = 1.0 - (diff / 3.0);
            if (budgetSim > 0.9) currentReasons.push("Similar budget preference");
            else if (budgetSim < 0.4) currentReasons.push("Different budget preference");

            // 5. Travel Style
            const styleSim = getJaccard(currentUser.travel_style, tripCreator.travel_style);
            if (styleSim > 0.4) currentReasons.push("Compatible travel styles");

            // 6. Activities
            const actSim = getJaccard(myTrip.travel_interests, trip.travel_interests);

            score = (destMatch * 25) + (dateOverlap * 25) + (intSim * 20) + (budgetSim * 15) + (styleSim * 10) + (actSim * 5);
            score = Math.min(100, Math.max(0, Math.round(score)));

            if (score >= bestScore) {
              bestScore = score;
              reasons = currentReasons;
            }
          }
        } else {
          // Profile fallback
          const intSim = getJaccard(currentUser.interests, tripCreator.interests);
          const sharedInts = (currentUser.interests || []).filter(x => (tripCreator.interests || []).includes(x));
          if (sharedInts.length > 0) {
            reasons.push(`Shared interests: ${sharedInts.slice(0, 3).join(', ')}`);
          }

          const tierA = getBudgetTier(currentUser.budget_preference);
          const tierB = getBudgetTier(tripCreator.bio ? 'Moderate' : 'Moderate');
          const diff = Math.abs(tierA - tierB);
          const budgetSim = 1.0 - (diff / 3.0);
          if (budgetSim > 0.9) reasons.push("Similar budget preference");

          const styleSim = getJaccard(currentUser.travel_style, tripCreator.travel_style);
          if (styleSim > 0.4) reasons.push("Compatible travel styles");

          bestScore = (intSim * 40) + (budgetSim * 30) + (styleSim * 30);
          bestScore = Math.min(100, Math.max(0, Math.round(bestScore)));
        }

        let tier = 'Possible Match';
        if (bestScore >= 85) tier = 'Best Match';
        else if (bestScore >= 70) tier = 'Strong Match';
        else if (bestScore >= 55) tier = 'Good Match';
        else if (bestScore >= 35) tier = 'Possible Match';
        else tier = 'Low Match';

        return {
          id: trip.id,
          destination: trip.destination,
          start_date: trip.start_date,
          end_date: trip.end_date,
          approximate_budget: trip.approximate_budget,
          travel_interests: trip.travel_interests,
          preferred_travel_style: trip.preferred_travel_style,
          number_of_travelers: trip.number_of_travelers,
          description: trip.description,
          user: userMini,
          compatibility: `${bestScore}% Match`,
          match_score: bestScore,
          match_tier: tier,
          match_reasons: reasons,
          match_method: 'Rule-Based Compatibility',
        };
      });

      // Sort by match score descending
      discoveryCards.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
      return discoveryCards;
    } else {
      const res = await api.get('/travel-buddies');
      return res.data;
    }
  },
};

export const requestService = {
  async sendRequest(tripId: string, receiverId: string) {
    if (USE_MOCK) {
      await delay(400);
      const currentUser = getCurrentMockUser();
      const requests = getFromDB<TravelRequest>('tripmate_requests');

      const existing = requests.find(
        (r) => r.sender_id === currentUser.id && r.receiver_id === receiverId && r.trip_id === tripId
      );
      if (existing) return existing;

      const newRequest: TravelRequest = {
        id: 'req_' + Date.now(),
        sender_id: currentUser.id,
        receiver_id: receiverId,
        trip_id: tripId,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      requests.push(newRequest);
      saveToDB('tripmate_requests', requests);
      return newRequest;
    } else {
      const res = await api.post(`/trips/${tripId}/join-request`);
      return res.data;
    }
  },

  async sendBuddyRequest(receiverId: string, tripId?: string) {
    if (USE_MOCK) {
      await delay(400);
      const currentUser = getCurrentMockUser();
      const requests = getFromDB<TravelRequest>('tripmate_requests');

      const newRequest: TravelRequest = {
        id: 'req_' + Date.now(),
        sender_id: currentUser.id,
        receiver_id: receiverId,
        trip_id: tripId || '',
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      requests.push(newRequest);
      saveToDB('tripmate_requests', requests);
      return newRequest;
    } else {
      const res = await api.post('/requests', {
        receiver_id: receiverId,
        trip_id: tripId,
        request_type: 'buddy_request'
      });
      return res.data;
    }
  },

  async getIncomingRequests() {
    if (USE_MOCK) {
      await delay(300);
      const currentUser = getCurrentMockUser();
      const requests = getFromDB<TravelRequest>('tripmate_requests');
      const users = getFromDB<User>('tripmate_users');
      const trips = getFromDB<Trip>('tripmate_trips');

      const incoming = requests.filter((r) => r.receiver_id === currentUser.id && r.status === 'pending');
      
      return incoming.map((req) => {
        const sender = users.find((u) => u.id === req.sender_id);
        const trip = trips.find((t) => t.id === req.trip_id);
        return {
          ...req,
          sender: sender ? {
            id: sender.id,
            name: sender.name,
            profile_photo: sender.profile_photo,
            bio: sender.bio,
            interests: sender.interests,
            travel_style: sender.travel_style,
          } : undefined,
          trip: trip ? {
            id: trip.id,
            destination: trip.destination,
            start_date: trip.start_date,
            end_date: trip.end_date,
            approximate_budget: trip.approximate_budget,
            description: trip.description,
          } : undefined,
        };
      });
    } else {
      const res = await api.get('/trip-join-requests/incoming');
      return res.data;
    }
  },

  async getSentRequests() {
    if (USE_MOCK) {
      await delay(300);
      const currentUser = getCurrentMockUser();
      const requests = getFromDB<TravelRequest>('tripmate_requests');
      const users = getFromDB<User>('tripmate_users');
      const trips = getFromDB<Trip>('tripmate_trips');

      const sent = requests.filter((r) => r.sender_id === currentUser.id);

      return sent.map((req) => {
        const receiver = users.find((u) => u.id === req.receiver_id);
        const trip = trips.find((t) => t.id === req.trip_id);
        return {
          ...req,
          receiver: receiver ? {
            id: receiver.id,
            name: receiver.name,
            profile_photo: receiver.profile_photo,
            bio: receiver.bio,
            interests: receiver.interests,
            travel_style: receiver.travel_style,
          } : undefined,
          trip: trip ? {
            id: trip.id,
            destination: trip.destination,
            start_date: trip.start_date,
            end_date: trip.end_date,
            approximate_budget: trip.approximate_budget,
            description: trip.description,
          } : undefined,
        };
      });
    } else {
      const res = await api.get('/trip-join-requests/sent');
      return res.data;
    }
  },

  async acceptRequest(requestId: string) {
    if (USE_MOCK) {
      await delay(400);
      const requests = getFromDB<TravelRequest>('tripmate_requests');
      const reqIdx = requests.findIndex((r) => r.id === requestId);
      if (reqIdx === -1) throw { response: { status: 404, data: { detail: 'Request not found' } } };

      requests[reqIdx].status = 'accepted';
      saveToDB('tripmate_requests', requests);

      const acceptedReq = requests[reqIdx];
      
      const connections = getFromDB<Connection>('tripmate_connections');
      const users = getFromDB<User>('tripmate_users');
      const trips = getFromDB<Trip>('tripmate_trips');
      
      const buddyUser = users.find((u) => u.id === acceptedReq.sender_id) || users[0];
      const sharedTrip = trips.find((t) => t.id === acceptedReq.trip_id) || trips[0];
      
      const newConnection: Connection = {
        id: 'conn_' + Date.now(),
        user1_id: acceptedReq.sender_id,
        user2_id: acceptedReq.receiver_id,
        trip_id: acceptedReq.trip_id || '',
        created_at: new Date().toISOString(),
        buddy: {
          id: buddyUser.id,
          name: buddyUser.name,
          profile_photo: buddyUser.profile_photo,
          bio: buddyUser.bio,
          interests: buddyUser.interests,
          travel_style: buddyUser.travel_style,
        },
        shared_trip: {
          id: sharedTrip.id,
          destination: sharedTrip.destination,
          start_date: sharedTrip.start_date,
          end_date: sharedTrip.end_date,
          approximate_budget: sharedTrip.approximate_budget,
          description: sharedTrip.description,
        }
      };

      connections.push(newConnection);
      saveToDB('tripmate_connections', connections);

      return acceptedReq;
    } else {
      const res = await api.patch(`/trip-join-requests/${requestId}/accept`);
      return res.data;
    }
  },

  async rejectRequest(requestId: string) {
    if (USE_MOCK) {
      await delay(350);
      const requests = getFromDB<TravelRequest>('tripmate_requests');
      const reqIdx = requests.findIndex((r) => r.id === requestId);
      if (reqIdx === -1) throw { response: { status: 404, data: { detail: 'Request not found' } } };

      requests[reqIdx].status = 'rejected';
      saveToDB('tripmate_requests', requests);
      return requests[reqIdx];
    } else {
      const res = await api.patch(`/trip-join-requests/${requestId}/reject`);
      return res.data;
    }
  },

  async cancelRequest(requestId: string) {
    if (USE_MOCK) {
      await delay(350);
      const requests = getFromDB<TravelRequest>('tripmate_requests');
      const filtered = requests.filter((r) => r.id !== requestId);
      saveToDB('tripmate_requests', filtered);
      return { success: true };
    } else {
      const res = await api.patch(`/trip-join-requests/${requestId}/cancel`);
      return res.data;
    }
  },
};

export const connectionService = {
  async getConnections() {
    if (USE_MOCK) {
      await delay(300);
      const currentUser = getCurrentMockUser();
      const connections = getFromDB<Connection>('tripmate_connections');
      const users = getFromDB<User>('tripmate_users');
      const trips = getFromDB<Trip>('tripmate_trips');

      // Filter connections involving current user
      const userConns = connections.filter(
        (c) => c.user1_id === currentUser.id || c.user2_id === currentUser.id
      );

      return userConns.map((conn) => {
        const otherUserId = conn.user1_id === currentUser.id ? conn.user2_id : conn.user1_id;
        const buddy = users.find((u) => u.id === otherUserId) || users[0];
        const trip = trips.find((t) => t.id === conn.trip_id) || trips[0];
        
        return {
          ...conn,
          buddy: {
            id: buddy.id,
            name: buddy.name,
            profile_photo: buddy.profile_photo,
            bio: buddy.bio,
            interests: buddy.interests,
            travel_style: buddy.travel_style,
          },
          shared_trip: {
            id: trip.id,
            destination: trip.destination,
            start_date: trip.start_date,
            end_date: trip.end_date,
            approximate_budget: trip.approximate_budget,
            description: trip.description,
          }
        };
      });
    } else {
      const res = await api.get('/connections');
      return res.data;
    }
  },

  async removeConnection(connectionId: string) {
    if (USE_MOCK) {
      await delay(300);
      const connections = getFromDB<Connection>('tripmate_connections');
      const filtered = connections.filter((c) => c.id !== connectionId);
      saveToDB('tripmate_connections', filtered);
      return { success: true };
    } else {
      const res = await api.delete(`/connections/${connectionId}`);
      return res.data;
    }
  },
};

export const messageService = {
  async getMessages(connectionId: string) {
    if (USE_MOCK) {
      await delay(150);
      const messages = getFromDB<Message>('tripmate_messages');
      
      // Update read status for messages sent to current user in this connection
      const currentUser = getCurrentMockUser();
      const updatedMessages = messages.map((m) => {
        if (m.connection_id === connectionId && m.receiver_id === currentUser.id) {
          return { ...m, is_read: true };
        }
        return m;
      });
      saveToDB('tripmate_messages', updatedMessages);

      return updatedMessages.filter((m) => m.connection_id === connectionId);
    } else {
      const res = await api.get(`/connections/${connectionId}/messages`);
      return res.data;
    }
  },

  async sendMessage(connectionId: string, content: string) {
    if (USE_MOCK) {
      await delay(200);
      const currentUser = getCurrentMockUser();
      const connections = getFromDB<Connection>('tripmate_connections');
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn) throw { response: { status: 404, data: { detail: 'Connection not found' } } };

      const otherUserId = conn.user1_id === currentUser.id ? conn.user2_id : conn.user1_id;
      const messages = getFromDB<Message>('tripmate_messages');

      const newMessage: Message = {
        id: 'msg_' + Date.now(),
        connection_id: connectionId,
        sender_id: currentUser.id,
        receiver_id: otherUserId,
        content: content,
        timestamp: new Date().toISOString(),
        is_read: false,
      };

      messages.push(newMessage);
      saveToDB('tripmate_messages', messages);

      // Trigger simulated response timer (1.5 seconds delay)
      setTimeout(() => {
        const freshConns = getFromDB<Connection>('tripmate_connections');
        const connStillExists = freshConns.some((c) => c.id === connectionId);
        if (!connStillExists) return;

        const replies = COMPANION_REPLIES[otherUserId] || [
          "Awesome! Sounds like a great plan.",
          "I will look into it and let you know soon.",
          "Let's catch up and discuss the details!"
        ];
        
        // Pick a reply sequence or random
        const freshMsgs = getFromDB<Message>('tripmate_messages');
        const companionMsgsSent = freshMsgs.filter(m => m.connection_id === connectionId && m.sender_id === otherUserId);
        const replyIndex = companionMsgsSent.length % replies.length;
        const replyContent = replies[replyIndex];

        const companionReply: Message = {
          id: 'msg_reply_' + Date.now(),
          connection_id: connectionId,
          sender_id: otherUserId,
          receiver_id: currentUser.id,
          content: replyContent,
          timestamp: new Date().toISOString(),
          is_read: false,
        };

        freshMsgs.push(companionReply);
        saveToDB('tripmate_messages', freshMsgs);
      }, 1500);

      return newMessage;
    } else {
      const res = await api.post(`/connections/${connectionId}/messages`, { content });
      return res.data;
    }
  },
};

// ==========================================
// AI PLANNING & WEATHER SERVICES
// ==========================================

const getMockWeather = (destination: string): any => {
  const query = destination.toLowerCase();
  const isRainy = query.includes('goa') || query.includes('bali');
  const temp = query.includes('manali') ? 14 : 28;
  const cond = isRainy ? 'Scattered Rain / Light Showers' : 'Sunny / Clear Skies';
  const prob = isRainy ? 65 : 10;
  
  const forecast = [];
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    forecast.push({
      date: d.toISOString().split('T')[0],
      temp_c: temp + (i % 2 === 0 ? 1.5 : -1),
      condition: cond,
      rain_prob: prob,
      icon: isRainy ? '//cdn.weatherapi.com/weather/64x64/day/296.png' : '//cdn.weatherapi.com/weather/64x64/day/113.png'
    });
  }

  const warnings = [];
  if (isRainy) {
    warnings.push('Yellow warning: Expect moderate rainfall in coastal areas.');
  }
  if (temp > 35) {
    warnings.push('Extreme heat warning: Limit direct afternoon exposure.');
  }

  return {
    destination,
    is_available: true,
    forecast,
    warnings,
    source: 'Simulated Weather Data (Mock Mode)'
  };
};

const generateMockItinerary = (trip: Trip, weather: any) => {
  const start = new Date(trip.start_date);
  const end = new Date(trip.end_date);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const numDays = Math.min(Math.max(diffDays, 1), 7);

  const interests = trip.travel_interests || [];
  const styles = trip.preferred_travel_style || [];
  const primaryInterest = interests[0] || 'Sightseeing';
  const primaryStyle = styles[0] || 'Relaxed';

  const days = [];
  for (let i = 1; i <= numDays; i++) {
    days.push({
      day_number: i,
      morning: {
        activity_name: `Explore local ${primaryInterest} spot in ${trip.destination}`,
        description: `Kickstart your day exploring the beautiful scenery or cultural sites around ${trip.destination}.`,
        why_matches: `Matches your interest in ${primaryInterest}.`,
        suggested_duration: "2.5 hours",
        time_of_day: "Morning",
        activity_type: primaryInterest
      },
      afternoon: {
        activity_name: `Relaxed local food tour & cafe hopping`,
        description: `Sample local delicacies and escape any mid-day heat or showers in a comfortable indoor setting.`,
        why_matches: `Fits your ${primaryStyle} travel style.`,
        suggested_duration: "2 hours",
        time_of_day: "Afternoon",
        activity_type: "Food"
      },
      evening: {
        activity_name: `Sunset views & leisure walking`,
        description: `Watch the sunset from a famous local spot, followed by dinner.`,
        why_matches: `Highly recommended evening experience.`,
        suggested_duration: "3 hours",
        time_of_day: "Evening",
        activity_type: "Relaxation"
      }
    });
  }

  const recommendations = [
    {
      place_name: `Scenic Viewpoint in ${trip.destination}`,
      description: "A spectacular viewpoint offering panorama shots of the surrounding area.",
      why_matches: "Perfect for photography and nature lovers.",
      suggested_duration: "1.5 hours",
      recommended_visiting_period: "Morning",
      activity_type: "Photography"
    },
    {
      place_name: `Local Heritage Market`,
      description: "Historic marketplace known for spices, local crafts, and delicious street food.",
      why_matches: "Perfect to experience local culture and food.",
      suggested_duration: "2 hours",
      recommended_visiting_period: "Afternoon",
      activity_type: "Culture"
    }
  ];

  const outfit_recommendations = [
    {
      category: "Everyday",
      items: ["Breathable cotton t-shirts", "Comfortable walking shorts", "Sunglasses"],
      advice: "Keep it light and comfortable for moving around."
    },
    {
      category: "Outdoor",
      items: ["Sturdy trail shoes", "Sunscreen (SPF 50+)", "Wide-brim hat"],
      advice: "Essential protection for sunny outdoor walking tours."
    }
  ];

  const isRainy = weather.forecast.some((d: any) => d.rain_prob > 50);
  if (isRainy) {
    outfit_recommendations.push({
      category: "Rainy Weather",
      items: ["Windproof compact umbrella", "Light waterproof jacket", "Water-resistant sneakers"],
      advice: "Expect light afternoon showers. Keep rain gear in your daypack."
    });
  }

  const packing_checklist = [
    { id: 'item_1', name: "Passport & Identity Documents", category: "Documents", quantity: 1, is_packed: false },
    { id: 'item_2', name: "Universal Travel Adapter", category: "Electronics", quantity: 1, is_packed: false },
    { id: 'item_3', name: "Comfortable Walking Shoes", category: "Clothing", quantity: 1, is_packed: false },
    { id: 'item_4', name: "Refillable Water Bottle", category: "Emergency Essentials", quantity: 1, is_packed: false },
    { id: 'item_5', name: "Toothbrush & Paste", category: "Personal Care", quantity: 1, is_packed: false }
  ];

  return {
    trip_id: trip.id,
    user_id: trip.user_id,
    destination: trip.destination,
    days,
    recommendations,
    outfit_recommendations,
    packing_checklist,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    chat_history: []
  };
};

export const weatherService = {
  async getForecast(tripId: string, destination: string) {
    const res = await api.get(`/trips/${tripId}/weather`);
    const data = res.data;
    return {
      destination_name: data.destination,
      forecast_available: data.forecast_available,
      timezone: data.timezone,
      weather: (data.days || []).map((d: any) => ({
        date: d.date,
        temp_max: d.temperature_max,
        temp_min: d.temperature_min,
        condition: d.weather_condition,
        rain_probability: d.rain_probability,
        precipitation: d.precipitation,
        wind_speed: d.wind_speed,
        morning: d.morning,
        afternoon: d.afternoon,
        evening: d.evening,
        warning: d.rain_probability > 60 ? "High Rain Risk" : null
      })),
      message: data.message || (data.forecast_available ? "Live Forecast" : "Detailed weather forecast is not available yet for these dates.")
    };
  },

  async getGeneralForecast(destination: string, startDate: string, endDate: string) {
    const res = await api.get('/weather/forecast', {
      params: {
        destination,
        start_date: startDate,
        end_date: endDate
      }
    });
    const data = res.data;
    return {
      destination_name: data.destination,
      forecast_available: data.forecast_available,
      timezone: data.timezone,
      weather: (data.days || []).map((d: any) => ({
        date: d.date,
        temp_max: d.temperature_max,
        temp_min: d.temperature_min,
        condition: d.weather_condition,
        rain_probability: d.rain_probability,
        precipitation: d.precipitation,
        wind_speed: d.wind_speed,
        morning: d.morning,
        afternoon: d.afternoon,
        evening: d.evening,
        warning: d.rain_probability > 60 ? "High Rain Risk" : null
      })),
      message: data.message || (data.forecast_available ? "Live Forecast" : "Detailed weather forecast is not available yet for these dates.")
    };
  }
};

const mapMockPlanToRealPlan = (mockPlan: any): any => {
  return {
    trip_id: mockPlan.trip_id,
    places: (mockPlan.recommendations || []).map((r: any) => ({
      name: r.place_name,
      description: r.description,
      why_matches: r.why_matches,
      suggested_duration: r.suggested_duration,
      recommended_visiting_period: r.recommended_visiting_period,
      activity_type: r.activity_type
    })),
    visiting_times_explanation: {
      morning: "Morning hours are great for outdoor exploring to beat the daytime heat.",
      afternoon: "Afternoon hours are perfect for local lunch and visiting indoor galleries.",
      evening: "Evening is recommended for sunset views, dinners, and nightlife."
    },
    itinerary: (mockPlan.days || []).map((d: any) => ({
      day: d.day_number,
      morning: d.morning ? [{
        place_name: d.morning.activity_name,
        activity: d.morning.description,
        duration: d.morning.suggested_duration
      }] : [],
      afternoon: d.afternoon ? [{
        place_name: d.afternoon.activity_name,
        activity: d.afternoon.description,
        duration: d.afternoon.suggested_duration
      }] : [],
      evening: d.evening ? [{
        place_name: d.evening.activity_name,
        activity: d.evening.description,
        duration: d.evening.suggested_duration
      }] : []
    })),
    outfit_recommendations: (mockPlan.outfit_recommendations || []).map((o: any) => 
      `${o.category}: ${o.items.join(', ')}. Advice: ${o.advice}`
    ),
    packing_checklist: {
      clothing: (mockPlan.packing_checklist || []).filter((i: any) => i.category.toLowerCase() === 'clothing').map((i: any) => ({ item: i.name, checked: i.is_packed })),
      weather: (mockPlan.packing_checklist || []).filter((i: any) => i.category.toLowerCase() === 'weather').map((i: any) => ({ item: i.name, checked: i.is_packed })),
      personal_care: (mockPlan.packing_checklist || []).filter((i: any) => i.category.toLowerCase() === 'personal care' || i.category.toLowerCase() === 'personal_care').map((i: any) => ({ item: i.name, checked: i.is_packed })),
      electronics: (mockPlan.packing_checklist || []).filter((i: any) => i.category.toLowerCase() === 'electronics').map((i: any) => ({ item: i.name, checked: i.is_packed })),
      documents: (mockPlan.packing_checklist || []).filter((i: any) => i.category.toLowerCase() === 'documents').map((i: any) => ({ item: i.name, checked: i.is_packed })),
      activity_specific: (mockPlan.packing_checklist || []).filter((i: any) => i.category.toLowerCase() === 'activity' || i.category.toLowerCase() === 'activity_specific').map((i: any) => ({ item: i.name, checked: i.is_packed })),
      emergency_essentials: (mockPlan.packing_checklist || []).filter((i: any) => i.category.toLowerCase() === 'emergency' || i.category.toLowerCase() === 'emergency_essentials').map((i: any) => ({ item: i.name, checked: i.is_packed })),
    },
    created_at: mockPlan.created_at
  };
};

export const locationService = {
  async searchLocations(query: string, limit = 10): Promise<{ results: LocationResult[] }> {
    if (!query || query.trim().length < 2) {
      return { results: [] };
    }
    const cleanQ = query.trim();
    
    // First try backend search endpoint which runs server-side typo tolerance & cache
    if (!USE_MOCK) {
      try {
        const res = await api.get('/locations/search', {
          params: { q: cleanQ, limit }
        });
        if (res.data?.results && res.data.results.length > 0) {
          return res.data;
        }
      } catch (e) {
        // Fall back to client-side search engine
      }
    }

    // Client-side search engine with typo-tolerance, popularity weighting, and multi-query Open-Meteo resolution
    try {
      const results = await searchAndRankDestinations(cleanQ, limit);
      return { results };
    } catch (err) {
      console.error("Geocoding search error:", err);
      return { results: [] };
    }
  },

  async resolveLocation(query: string, location?: LocationResult): Promise<{ location: LocationResult }> {
    if (location) return { location };
    const search = await this.searchLocations(query, 1);
    if (search.results && search.results.length > 0) {
      return { location: search.results[0] };
    }
    throw new Error(`Location '${query}' not found`);
  }
};

export const aiService = {
  async getSavedPlan(tripId: string) {
    if (USE_MOCK) {
      await delay(200);
      const plans = getFromDB<any>('tripmate_ai_plans');
      const plan = plans.find((p: any) => p.trip_id === tripId);
      if (!plan) throw { response: { status: 404, data: { detail: 'Plan not found' } } };
      return mapMockPlanToRealPlan(plan);
    } else {
      const res = await api.get(`/trips/${tripId}/ai-plan`);
      return res.data;
    }
  },

  async generatePlan(tripId: string, regenerate = false) {
    if (USE_MOCK) {
      await delay(1200);
      const trips = getFromDB<Trip>('tripmate_trips');
      const trip = trips.find((t) => t.id === tripId);
      if (!trip) throw { response: { status: 404, data: { detail: 'Trip not found' } } };

      const weather = getMockWeather(trip.destination);
      const plan = generateMockItinerary(trip, weather);

      const plans = getFromDB<any>('tripmate_ai_plans');
      const existingIdx = plans.findIndex((p: any) => p.trip_id === tripId);
      if (existingIdx !== -1) {
        plans[existingIdx] = plan;
      } else {
        plans.push(plan);
      }
      saveToDB('tripmate_ai_plans', plans);
      return mapMockPlanToRealPlan(plan);
    } else {
      const res = await api.post(`/trips/${tripId}/ai-plan`, { regenerate });
      return res.data;
    }
  },

  async mutateChecklist(tripId: string, category: string, item: string, checked?: boolean, action?: string) {
    if (USE_MOCK) {
      await delay(200);
      const plans = getFromDB<any>('tripmate_ai_plans');
      const planIdx = plans.findIndex((p: any) => p.trip_id === tripId);
      if (planIdx === -1) throw { response: { status: 404, data: { detail: 'Plan not found' } } };

      const plan = plans[planIdx];
      if (!plan.packing_checklist) plan.packing_checklist = [];

      if (action === 'toggle' || checked !== undefined) {
        const itm = plan.packing_checklist.find((i: any) => i.name === item);
        if (itm) itm.is_packed = checked !== undefined ? checked : !itm.is_packed;
      } else if (action === 'add') {
        plan.packing_checklist.push({
          id: 'item_' + Date.now(),
          name: item,
          category,
          quantity: 1,
          is_packed: false
        });
      } else if (action === 'remove') {
        plan.packing_checklist = plan.packing_checklist.filter((i: any) => i.name !== item);
      }
      plan.updated_at = new Date().toISOString();
      saveToDB('tripmate_ai_plans', plans);
      return mapMockPlanToRealPlan(plan);
    } else {
      const res = await api.put(`/trips/${tripId}/ai-plan/checklist`, {
        category,
        item,
        checked,
        action
      });
      return res.data;
    }
  },

  async sendChatMessage(tripId: string, message: string) {
    if (USE_MOCK) {
      await delay(600);
      const plans = getFromDB<any>('tripmate_ai_plans');
      const planIdx = plans.findIndex((p: any) => p.trip_id === tripId);
      if (planIdx === -1) throw { response: { status: 404, data: { detail: 'Plan not found' } } };

      const plan = plans[planIdx];
      if (!plan.chat_history) plan.chat_history = [];

      const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
      plan.chat_history.push(userMsg);

      let replyContent = `Here are some recommendations for ${plan.destination}: You can explore the iconic viewpoints and local food street!`;
      const replyMsg = { role: 'assistant', content: replyContent, timestamp: new Date().toISOString() };
      plan.chat_history.push(replyMsg);
      saveToDB('tripmate_ai_plans', plans);

      return replyMsg;
    } else {
      const res = await api.post(`/trips/${tripId}/ai-chat`, { message });
      return res.data;
    }
  },

  async getChatHistory(tripId: string) {
    if (USE_MOCK) {
      await delay(200);
      const plans = getFromDB<any>('tripmate_ai_plans');
      const plan = plans.find((p: any) => p.trip_id === tripId);
      return plan?.chat_history || [];
    } else {
      const res = await api.get(`/trips/${tripId}/ai-chat/history`);
      return res.data;
    }
  },

  async updatePackingItem(tripId: string, itemId: string, fields: any) {
    if (USE_MOCK) {
      await delay(200);
      const plans = getFromDB<any>('tripmate_ai_plans');
      const planIdx = plans.findIndex((p: any) => p.trip_id === tripId);
      if (planIdx === -1) throw { response: { status: 404, data: { detail: 'Plan not found' } } };

      const checklist = plans[planIdx].packing_checklist || [];
      const itemIdx = checklist.findIndex((i: any) => i.id === itemId);
      if (itemIdx !== -1) {
        checklist[itemIdx] = { ...checklist[itemIdx], ...fields };
        plans[planIdx].packing_checklist = checklist;
        plans[planIdx].updated_at = new Date().toISOString();
        saveToDB('tripmate_ai_plans', plans);
      }
      return mapMockPlanToRealPlan(plans[planIdx]);
    } else {
      const res = await api.put(`/trips/${tripId}/ai-plan/checklist`, {
        category: fields.category || 'clothing',
        item: fields.name,
        checked: fields.is_packed,
        action: 'toggle'
      });
      return res.data;
    }
  },

  async addPackingItem(tripId: string, name: string, category: string, quantity = 1) {
    if (USE_MOCK) {
      await delay(200);
      const plans = getFromDB<any>('tripmate_ai_plans');
      const planIdx = plans.findIndex((p: any) => p.trip_id === tripId);
      if (planIdx === -1) throw { response: { status: 404, data: { detail: 'Plan not found' } } };

      const newItem = {
        id: 'item_custom_' + Date.now(),
        name,
        category,
        quantity,
        is_packed: false
      };

      plans[planIdx].packing_checklist.push(newItem);
      plans[planIdx].updated_at = new Date().toISOString();
      saveToDB('tripmate_ai_plans', plans);
      return mapMockPlanToRealPlan(plans[planIdx]);
    } else {
      const res = await api.put(`/trips/${tripId}/ai-plan/checklist`, {
        category,
        item: name,
        action: 'add'
      });
      return res.data;
    }
  },

  async deletePackingItem(tripId: string, itemId: string) {
    if (USE_MOCK) {
      await delay(100);
      const plans = getFromDB<any>('tripmate_ai_plans');
      const planIdx = plans.findIndex((p: any) => p.trip_id === tripId);
      if (planIdx === -1) throw { response: { status: 404, data: { detail: 'Plan not found' } } };

      const checklist = plans[planIdx].packing_checklist || [];
      plans[planIdx].packing_checklist = checklist.filter((i: any) => i.id !== itemId);
      plans[planIdx].updated_at = new Date().toISOString();
      saveToDB('tripmate_ai_plans', plans);
      return mapMockPlanToRealPlan(plans[planIdx]);
    } else {
      const res = await api.put(`/trips/${tripId}/ai-plan/checklist`, {
        category: 'clothing',
        item: itemId,
        action: 'remove'
      });
      return res.data;
    }
  },

  async chatWithAssistant(tripId: string, message: string) {
    const res = await this.sendChatMessage(tripId, message);
    return { reply: res.content, timestamp: res.timestamp };
  },

  async getRecommendations(
    destination: string,
    interests: string[],
    travelStyle: string,
    budget: string,
    numberOfTravelers: number,
    activities: string[] = [],
    location?: LocationResult | null
  ) {
    if (USE_MOCK) {
      await delay(600);
      const destTitle = location?.name || destination;
      const cats = [
        {
          category_name: "Top Iconic Landmarks & Sightseeing",
          places: [
            {
              name: `${destTitle} Historic Old Town & Viewpoint`,
              description: `A celebrated cultural and scenic landmark in ${destTitle} showcasing iconic vistas and architecture.`,
              why_matches: `Matches your interest in ${interests[0] || 'Sightseeing'} and ${travelStyle} travel style.`,
              selected: true
            },
            {
              name: `${destTitle} Central Promenade & Botanical Garden`,
              description: `Lush nature trails and walking gardens offering a tranquil retreat in the heart of ${destTitle}.`,
              why_matches: `Perfect for relaxed sightseeing and nature lovers.`,
              selected: true
            }
          ]
        },
        {
          category_name: "Local Cuisine & Cultural Hotspots",
          places: [
            {
              name: `${destTitle} Traditional Street Food & Heritage Market`,
              description: `Vibrant bustling market offering famous regional culinary delicacies, artisan crafts, and authentic flavours.`,
              why_matches: `Highly recommended for food and cultural immersion.`,
              selected: true
            },
            {
              name: `${destTitle} Sunset Ridge & Panoramic Cafe`,
              description: `Scenic hillside cafe offering local beverages and 360-degree sunset perspectives.`,
              why_matches: `Ideal for evening relaxation and photography.`,
              selected: true
            }
          ]
        },
        {
          category_name: "Outdoor Exploration & Adventure",
          places: [
            {
              name: `${destTitle} Nature Trail & Valley View`,
              description: `Gentle hiking route surrounded by scenic ridges, fresh air, and photogenic lookout points.`,
              why_matches: `Great match for outdoor activities and group travel.`,
              selected: true
            }
          ]
        }
      ];
      return { destination: destTitle, categories: cats };
    } else {
      const res = await api.post('/ai/planner/recommendations', {
        destination,
        location: location || undefined,
        interests,
        travel_style: travelStyle,
        budget,
        number_of_travelers: numberOfTravelers,
        activities
      });
      return res.data;
    }
  },

  async generateItineraryPlan(
    destination: string,
    startDate: string,
    endDate: string,
    budget: string,
    interests: string[],
    travelStyle: string,
    numberOfTravelers: number,
    selectedPlaces: string[],
    activities: string[] = [],
    location?: LocationResult | null
  ) {
    if (USE_MOCK) {
      await delay(800);
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const numDays = Math.min(Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 1), 7);
      const destTitle = location?.name || destination;

      const itinerary = [];
      for (let d = 1; d <= numDays; d++) {
        const place1 = selectedPlaces[(d * 2 - 2) % selectedPlaces.length] || `${destTitle} Landmark`;
        const place2 = selectedPlaces[(d * 2 - 1) % selectedPlaces.length] || `${destTitle} Scenic View`;
        itinerary.push({
          day: d,
          weather_summary: "Mild, comfortable temperatures with clear morning skies.",
          morning: [
            {
              place_name: place1,
              activity: `Explore ${place1} during cool morning hours. Ideal for sightseeing and photography.`,
              duration: "2.5 hours"
            }
          ],
          afternoon: [
            {
              place_name: `${destTitle} Local Eateries & Artisans`,
              activity: `Sample authentic local specialties and browse local crafts out of the midday sun.`,
              duration: "2.0 hours"
            }
          ],
          evening: [
            {
              place_name: place2,
              activity: `Catch scenic sunset vistas at ${place2} followed by evening dinner.`,
              duration: "2.5 hours"
            }
          ]
        });
      }

      return {
        destination: destTitle,
        start_date: startDate,
        end_date: endDate,
        budget,
        itinerary,
        outfit_recommendations: [
          "Comfortable lightweight walking shoes and breathable cotton apparel for day tours.",
          "Light jacket or sweater for cooler mornings and elevated viewpoints.",
          "Sunglasses, sun protection (SPF 50+), and a compact umbrella for sudden mountain/coastal showers."
        ],
        packing_checklist: {
          clothing: [
            { item: "Comfortable Walking Shoes", checked: false },
            { item: "Breathable Day Shirts / Tees", checked: false },
            { item: "Lightweight Jacket / Layer", checked: false }
          ],
          weather_gear: [
            { item: "Compact Travel Umbrella", checked: false },
            { item: "UV Sunglasses & Sun Hat", checked: false }
          ],
          electronics: [
            { item: "Phone Charger & Power Bank", checked: false },
            { item: "Universal Adapter", checked: false }
          ],
          essentials: [
            { item: "Personal Identification & Tickets", checked: false },
            { item: "Refillable Water Bottle", checked: false },
            { item: "Basic First-aid / Medications", checked: false }
          ]
        },
        hotels: [
          { area: `${destTitle} Central Heritage Area`, type: "Boutique Hotel / Resort", description: `Centrally located with easy access to attractions and vibrant dining.` },
          { area: `${destTitle} Scenic View District`, type: "Eco-Lodge / Scenic Stay", description: `Quiet hillside setting with panoramic balconies and mountain/valley views.` }
        ],
        restaurants: [
          { area: "Old Town Market", type: "Traditional Kitchen", description: "Famous for regional tasting platters and signature homestyle dishes." },
          { area: "Riverside Promenade", type: "Rooftop Cafe & Bistro", description: "Relaxed ambiance with specialty coffees, organic meals, and scenic seating." }
        ]
      };
    } else {
      const res = await api.post('/ai/planner/generate', {
        destination,
        location: location || undefined,
        start_date: startDate,
        end_date: endDate,
        budget,
        interests,
        travel_style: travelStyle,
        number_of_travelers: numberOfTravelers,
        selected_places: selectedPlaces,
        activities
      });
      return res.data;
    }
  },

  async saveDraftPlan(planData: any) {
    if (USE_MOCK) {
      await delay(200);
      const drafts = getFromDB<any>('tripmate_saved_drafts');
      const newDraft = { ...planData, id: 'draft_' + Date.now(), saved_at: new Date().toISOString() };
      drafts.push(newDraft);
      saveToDB('tripmate_saved_drafts', drafts);
      return newDraft;
    }
    const res = await api.post('/ai/planner/save', planData);
    return res.data;
  },

  async updateDraftPlan(planId: string, planData: any) {
    if (USE_MOCK) {
      await delay(200);
      const drafts = getFromDB<any>('tripmate_saved_drafts');
      const idx = drafts.findIndex((d: any) => d.id === planId);
      if (idx !== -1) {
        drafts[idx] = { ...drafts[idx], ...planData, updated_at: new Date().toISOString() };
        saveToDB('tripmate_saved_drafts', drafts);
      }
      return { success: true };
    }
    const res = await api.put(`/ai/planner/${planId}`, planData);
    return res.data;
  },

  async getDraftPlan(planId: string) {
    if (USE_MOCK) {
      await delay(200);
      const drafts = getFromDB<any>('tripmate_saved_drafts');
      const draft = drafts.find((d: any) => d.id === planId);
      return draft || null;
    }
    const res = await api.get(`/ai/planner/${planId}`);
    return res.data;
  },

  async getDraftPlans() {
    if (USE_MOCK) {
      await delay(200);
      return getFromDB<any>('tripmate_saved_drafts') || [];
    }
    const res = await api.get('/ai/planner');
    return res.data;
  },

  async getPlannerOptions() {
    if (USE_MOCK) {
      return {
        interests: ['Nature', 'Photography', 'Food', 'Adventure', 'Shopping', 'History', 'Culture', 'Nightlife', 'Relaxation'],
        travel_styles: ['Budget', 'Relaxed', 'Adventure', 'Luxury', 'Balanced', 'Backpacking', 'Family'],
        budgets: ['Budget', 'Balanced', 'Luxury'],
        activities: ['Hiking', 'Sightseeing', 'Museum visiting', 'Beach walk', 'Shopping', 'Dining', 'Spa & Wellness', 'Night clubs', 'Guided tours', 'Photography walk']
      };
    }
    const res = await api.get('/ai/planner/options');
    return res.data;
  },

  async deleteDraftPlan(planId: string) {
    if (USE_MOCK) {
      await delay(100);
      const drafts = getFromDB<any>('tripmate_saved_drafts');
      saveToDB('tripmate_saved_drafts', drafts.filter((d: any) => d.id !== planId));
      return { success: true };
    }
    const res = await api.delete(`/ai/planner/${planId}`);
    return res.data;
  },

  async suggestAndAddPlace(destination: string, prompt: string) {
    if (USE_MOCK) {
      await delay(400);
      return {
        places: [
          {
            name: `${prompt} in ${destination}`,
            description: `Custom suggested spot matching "${prompt}" in ${destination}.`,
            why_matches: `Direct match for custom user search.`,
            selected: true
          }
        ]
      };
    }
    const res = await api.post('/ai/planner/recommendations/add', {
      destination,
      prompt
    });
    return res.data;
  },

  async regenerateDayPlan(dayData: any) {
    if (USE_MOCK) {
      await delay(500);
      return {
        day: dayData.day,
        weather_summary: "Comfortable weather conditions.",
        morning: [{ place_name: `Morning Highlights (${dayData.custom_prompt || 'Updated'})`, activity: "Enjoy early morning explorations with optimized timing.", duration: "2.5 hours" }],
        afternoon: [{ place_name: `Local Food & Culture Spot`, activity: "Mid-day discovery and culinary lunch stop.", duration: "2.0 hours" }],
        evening: [{ place_name: `Evening Scenic Lookout`, activity: "Sunset view and dinner leisure.", duration: "2.5 hours" }]
      };
    }
    const res = await api.post('/ai/planner/regenerate-day', dayData);
    return res.data;
  },

  async saveTripPlan(tripId: string, planData: any) {
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }
    const res = await api.post(`/trips/${tripId}/ai-plan`, planData);
    return res.data;
  }
};

export const mlService = {
  async trainModel() {
    if (USE_MOCK) {
      await delay(1200);
      const metrics = {
        model_type: "Logistic Regression Classifier",
        trained_at: new Date().toISOString(),
        samples_count: 100,
        accuracy: 0.92,
        precision: 0.90,
        recall: 0.94,
        f1_score: 0.92,
        confusion_matrix: [[45, 5], [3, 47]]
      };
      saveToDB('tripmate_ml_metrics', [metrics]);
      return { status: "success", message: "Model trained and reloaded successfully.", metrics };
    } else {
      const res = await api.post('/ml/train');
      return res.data;
    }
  },

  async getMetrics() {
    if (USE_MOCK) {
      await delay(200);
      const metrics = getFromDB<any>('tripmate_ml_metrics');
      if (!metrics || metrics.length === 0) {
        return {
          model_type: "None",
          status: "Using Rule-Based Fallback System (Model not trained yet)",
          accuracy: 0.0,
          precision: 0.0,
          recall: 0.0,
          f1_score: 0.0
        };
      }
      return metrics[0];
    } else {
      const res = await api.get('/ml/metrics');
      return res.data;
    }
  }
};

export const safetyService = {
  async reportUserOrContent(reported_id: string, type: 'user'|'content', reason: string, details?: string) {
    if (USE_MOCK) {
      await delay(300);
      const reports = getFromDB<any>('tripmate_reports');
      const newReport = {
        id: 'rep_' + Date.now(),
        reporter_name: 'Current Tester',
        reporter_email: 'tester@tripmate.com',
        reported_id,
        type,
        reason,
        details,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      reports.push(newReport);
      saveToDB('tripmate_reports', reports);
      return { status: "success", message: "Report submitted successfully.", report: newReport };
    } else {
      const res = await api.post('/safety/report', { reported_id, type, reason, details });
      return res.data;
    }
  },

  async blockUser(blocked_id: string) {
    if (USE_MOCK) {
      await delay(300);
      const blocks = getFromDB<any>('tripmate_blocks');
      const existing = blocks.find((b: any) => b.blocked_id === blocked_id);
      if (existing) return { status: "success", message: "User is already blocked" };

      blocks.push({
        id: 'blk_' + Date.now(),
        blocked_id,
        created_at: new Date().toISOString()
      });
      saveToDB('tripmate_blocks', blocks);

      // Remove from connections
      const conns = getFromDB<any>('tripmate_connections');
      const filteredConns = conns.filter((c: any) => c.user1_id !== blocked_id && c.user2_id !== blocked_id);
      saveToDB('tripmate_connections', filteredConns);

      return { status: "success", message: "User blocked successfully." };
    } else {
      const res = await api.post('/safety/block', { blocked_id });
      return res.data;
    }
  },

  async getBlockedUsers() {
    if (USE_MOCK) {
      await delay(200);
      const blocks = getFromDB<any>('tripmate_blocks');
      const users = getFromDB<any>('tripmate_users');
      return blocks.map((b: any) => {
        const u = users.find((x: any) => x.id === b.blocked_id) || { name: 'Blocked Traveler', id: b.blocked_id };
        return {
          block_id: b.id,
          user_id: u.id,
          name: u.name,
          profile_photo: u.profile_photo || null,
          blocked_at: b.created_at
        };
      });
    } else {
      const res = await api.get('/safety/blocks');
      return res.data;
    }
  },

  async unblockUser(blocked_id: string) {
    if (USE_MOCK) {
      await delay(200);
      const blocks = getFromDB<any>('tripmate_blocks');
      const filtered = blocks.filter((b: any) => b.blocked_id !== blocked_id);
      saveToDB('tripmate_blocks', filtered);
      return { status: "success", message: "User unblocked successfully." };
    } else {
      const res = await api.delete(`/safety/blocks/${blocked_id}`);
      return res.data;
    }
  }
};

export const collaborationService = {
  async getWorkspace(tripId: string) {
    if (USE_MOCK) {
      await delay(300);
      const collabs = getFromDB<any>('tripmate_collaborations');
      let workspace = collabs.find((c: any) => c.trip_id === tripId);
      if (!workspace) {
        workspace = {
          id: 'col_' + Date.now(),
          trip_id: tripId,
          notes: [],
          suggested_places: [],
          saved_places: []
        };
        collabs.push(workspace);
        saveToDB('tripmate_collaborations', collabs);
      }
      return workspace;
    } else {
      const res = await api.get(`/trips/${tripId}/collaboration`);
      return res.data;
    }
  },

  async addNote(tripId: string, content: string) {
    if (USE_MOCK) {
      await delay(200);
      const collabs = getFromDB<any>('tripmate_collaborations');
      const idx = collabs.findIndex((c: any) => c.trip_id === tripId);
      if (idx === -1) throw new Error("Workspace not found");

      const newNote = {
        id: 'nte_' + Date.now(),
        author_id: 'usr_current',
        author_name: 'Current Traveler',
        content,
        created_at: new Date().toISOString()
      };
      collabs[idx].notes.push(newNote);
      saveToDB('tripmate_collaborations', collabs);
      return newNote;
    } else {
      const res = await api.post(`/trips/${tripId}/collaboration/notes`, { content });
      return res.data;
    }
  },

  async deleteNote(tripId: string, noteId: string) {
    if (USE_MOCK) {
      await delay(100);
      const collabs = getFromDB<any>('tripmate_collaborations');
      const idx = collabs.findIndex((c: any) => c.trip_id === tripId);
      if (idx === -1) throw new Error("Workspace not found");

      collabs[idx].notes = collabs[idx].notes.filter((n: any) => n.id !== noteId);
      saveToDB('tripmate_collaborations', collabs);
      return { success: true };
    } else {
      const res = await api.delete(`/trips/${tripId}/collaboration/notes/${noteId}`);
      return res.data;
    }
  },

  async suggestPlace(tripId: string, name: string, description?: string) {
    if (USE_MOCK) {
      await delay(200);
      const collabs = getFromDB<any>('tripmate_collaborations');
      const idx = collabs.findIndex((c: any) => c.trip_id === tripId);
      if (idx === -1) throw new Error("Workspace not found");

      const newSuggestion = {
        id: 'sug_' + Date.now(),
        name,
        description,
        suggested_by_id: 'usr_current',
        suggested_by_name: 'Current Traveler',
        status: 'pending',
        created_at: new Date().toISOString()
      };
      collabs[idx].suggested_places.push(newSuggestion);
      saveToDB('tripmate_collaborations', collabs);
      return newSuggestion;
    } else {
      const res = await api.post(`/trips/${tripId}/collaboration/places`, { name, description });
      return res.data;
    }
  },

  async updateSuggestionStatus(tripId: string, placeId: string, action: 'approved'|'rejected') {
    if (USE_MOCK) {
      await delay(250);
      const collabs = getFromDB<any>('tripmate_collaborations');
      const idx = collabs.findIndex((c: any) => c.trip_id === tripId);
      if (idx === -1) throw new Error("Workspace not found");

      const sugIdx = collabs[idx].suggested_places.findIndex((s: any) => s.id === placeId);
      if (sugIdx === -1) throw new Error("Suggestion not found");

      collabs[idx].suggested_places[sugIdx].status = action;

      if (action === 'approved') {
        const sug = collabs[idx].suggested_places[sugIdx];
        collabs[idx].saved_places.push({
          id: 'sav_' + Date.now(),
          name: sug.name,
          description: sug.description,
          saved_by_name: sug.suggested_by_name
        });
      }

      saveToDB('tripmate_collaborations', collabs);
      return { success: true };
    } else {
      const res = await api.put(`/trips/${tripId}/collaboration/places/${placeId}/status?action=${action}`);
      return res.data;
    }
  },

  async bookmarkPlace(tripId: string, name: string, description?: string) {
    if (USE_MOCK) {
      await delay(200);
      const collabs = getFromDB<any>('tripmate_collaborations');
      const idx = collabs.findIndex((c: any) => c.trip_id === tripId);
      if (idx === -1) throw new Error("Workspace not found");

      const newBookmark = {
        id: 'sav_' + Date.now(),
        name,
        description,
        saved_by_name: 'Current Traveler'
      };
      collabs[idx].saved_places.push(newBookmark);
      saveToDB('tripmate_collaborations', collabs);
      return newBookmark;
    } else {
      const res = await api.post(`/trips/${tripId}/collaboration/saved-places`, { name, description });
      return res.data;
    }
  },

  async deleteBookmarkedPlace(tripId: string, placeId: string) {
    if (USE_MOCK) {
      await delay(150);
      const collabs = getFromDB<any>('tripmate_collaborations');
      const idx = collabs.findIndex((c: any) => c.trip_id === tripId);
      if (idx === -1) throw new Error("Workspace not found");

      collabs[idx].saved_places = collabs[idx].saved_places.filter((p: any) => p.id !== placeId);
      saveToDB('tripmate_collaborations', collabs);
      return { success: true };
    } else {
      const res = await api.delete(`/trips/${tripId}/collaboration/saved-places/${placeId}`);
      return res.data;
    }
  },

  async getGroupMembers(tripId: string) {
    if (USE_MOCK) {
      await delay(200);
      const trips = getFromDB<Trip>('tripmate_trips');
      const trip = trips.find((t) => t.id === tripId);
      if (!trip) throw new Error("Trip not found");

      const users = getFromDB<User>('tripmate_users');
      const owner = users.find((u) => u.id === trip.user_id);
      
      const members = [];
      if (owner) {
        members.push({
          id: owner.id,
          name: owner.name,
          profile_photo: owner.profile_photo,
          role: 'Organizer',
          interests: owner.interests || [],
          travel_style: owner.travel_style || []
        });
      }

      const connections = getFromDB<Connection>('tripmate_connections');
      const tripConns = connections.filter((c) => c.trip_id === tripId);
      tripConns.forEach((c) => {
        const buddyId = c.user1_id === trip.user_id ? c.user2_id : c.user1_id;
        const buddy = users.find((u) => u.id === buddyId);
        if (buddy) {
          members.push({
            id: buddy.id,
            name: buddy.name,
            profile_photo: buddy.profile_photo,
            role: 'Member',
            interests: buddy.interests || [],
            travel_style: buddy.travel_style || []
          });
        }
      });
      return members;
    } else {
      const res = await api.get(`/trips/${tripId}/collaboration/members`);
      return res.data;
    }
  },

  async getGroupMessages(tripId: string) {
    if (USE_MOCK) {
      await delay(150);
      const collabs = getFromDB<any>('tripmate_collaborations');
      const collab = collabs.find((c: any) => c.trip_id === tripId);
      if (!collab) return [];
      return collab.messages || [];
    } else {
      const res = await api.get(`/trips/${tripId}/collaboration/messages`);
      return res.data;
    }
  },

  async postGroupMessage(tripId: string, content: string) {
    if (USE_MOCK) {
      await delay(100);
      const collabs = getFromDB<any>('tripmate_collaborations');
      const idx = collabs.findIndex((c: any) => c.trip_id === tripId);
      if (idx === -1) throw new Error("Workspace not found");

      const currentUser = getCurrentMockUser();
      const newMsg = {
        id: 'gmsg_' + Date.now(),
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        sender_photo: currentUser.profile_photo,
        content,
        created_at: new Date().toISOString()
      };

      if (!collabs[idx].messages) {
        collabs[idx].messages = [];
      }
      collabs[idx].messages.push(newMsg);
      saveToDB('tripmate_collaborations', collabs);
      return newMsg;
    } else {
      const res = await api.post(`/trips/${tripId}/collaboration/messages`, { content });
      return res.data;
    }
  }
};

export const adminService = {
  async getStats() {
    if (USE_MOCK) {
      await delay(300);
      return {
        users_count: 45,
        trips_count: 22,
        connections_count: 14,
        requests_count: 31,
        group_trips_count: 8,
        popular_destinations: [
          { destination: "Goa, India", count: 12 },
          { destination: "Manali, India", count: 8 },
          { destination: "Paris, France", count: 5 }
        ],
        reported_users_count: 1,
        reported_content_count: 2
      };
    } else {
      const res = await api.get('/admin/stats');
      return res.data;
    }
  },

  async getReports() {
    if (USE_MOCK) {
      await delay(200);
      const reports = getFromDB<any>('tripmate_reports');
      if (!reports || reports.length === 0) {
        return [
          {
            id: 'rep_mock_1',
            reporter_name: 'Jane Doe',
            reporter_email: 'jane@tripmate.com',
            reported_id: 'usr_bad',
            reported_name: 'Spammy Traveler',
            type: 'user',
            reason: 'Commercial spam and product advertisements',
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ];
      }
      return reports;
    } else {
      const res = await api.get('/admin/reports');
      return res.data;
    }
  },

  async resolveReport(reportId: string) {
    if (USE_MOCK) {
      await delay(200);
      const reports = getFromDB<any>('tripmate_reports');
      const idx = reports.findIndex((r: any) => r.id === reportId);
      if (idx !== -1) {
        reports[idx].status = 'resolved';
        saveToDB('tripmate_reports', reports);
      }
      return { success: true };
    } else {
      const res = await api.put(`/admin/reports/${reportId}/resolve`);
      return res.data;
    }
  },

  async suspendUser(userId: string, suspend = true) {
    if (USE_MOCK) {
      await delay(250);
      const users = getFromDB<any>('tripmate_users');
      const idx = users.findIndex((u: any) => u.id === userId);
      if (idx !== -1) {
        users[idx].is_suspended = suspend;
        saveToDB('tripmate_users', users);
      }
      return { success: true };
    } else {
      const res = await api.put(`/admin/users/${userId}/suspend?suspend=${suspend}`);
      return res.data;
    }
  },

  async deleteInappropriateTrip(tripId: string) {
    if (USE_MOCK) {
      await delay(300);
      const trips = getFromDB<any>('tripmate_trips');
      const filtered = trips.filter((t: any) => t.id !== tripId);
      saveToDB('tripmate_trips', filtered);
      return { success: true };
    } else {
      const res = await api.delete(`/admin/trips/${tripId}`);
      return res.data;
    }
  }
};

export const notificationService = {
  async getNotifications() {
    if (USE_MOCK) {
      await delay(150);
      let notifications = getFromDB<any>('tripmate_notifications');
      if (!notifications || notifications.length === 0) {
        // Return default mock notifications for rich layout testing
        const defaultNotifications = [
          {
            id: 'not_mock_1',
            user_id: 'u_1',
            type: 'request_received',
            title: 'New Travel Buddy Request',
            message: 'John Smith invited you to join their trip to Goa, India.',
            link: '/requests',
            is_read: false,
            created_at: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 'not_mock_2',
            user_id: 'u_1',
            type: 'new_connection',
            title: 'New Connection Established',
            message: 'You are now connected with Jane Doe for Paris, France.',
            link: '/connections',
            is_read: true,
            created_at: new Date(Date.now() - 86400000).toISOString()
          }
        ];
        saveToDB('tripmate_notifications', defaultNotifications);
        return defaultNotifications;
      }
      return notifications;
    } else {
      const res = await api.get('/notifications');
      return res.data;
    }
  },

  async markAsRead(notificationId: string) {
    if (USE_MOCK) {
      await delay(100);
      const notifications = getFromDB<any>('tripmate_notifications');
      const idx = notifications.findIndex((n: any) => n.id === notificationId);
      if (idx !== -1) {
        notifications[idx].is_read = true;
        saveToDB('tripmate_notifications', notifications);
      }
      return { success: true };
    } else {
      const res = await api.put(`/notifications/${notificationId}/read`);
      return res.data;
    }
  },

  async markAllAsRead() {
    if (USE_MOCK) {
      await delay(100);
      const notifications = getFromDB<any>('tripmate_notifications');
      notifications.forEach((n: any) => n.is_read = true);
      saveToDB('tripmate_notifications', notifications);
      return { success: true };
    } else {
      const res = await api.put('/notifications/read-all');
      return res.data;
    }
  },

  async deleteNotification(notificationId: string) {
    if (USE_MOCK) {
      await delay(100);
      const notifications = getFromDB<any>('tripmate_notifications');
      const filtered = notifications.filter((n: any) => n.id !== notificationId);
      saveToDB('tripmate_notifications', filtered);
      return { success: true };
    } else {
      const res = await api.delete(`/notifications/${notificationId}`);
      return res.data;
    }
  }
};

export default api;
