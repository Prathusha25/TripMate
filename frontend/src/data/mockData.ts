import { User, Trip, TravelRequest, Connection, Message } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    email: 'alex@example.com',
    name: 'Alex Mercer',
    profile_photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    bio: 'Avid traveler, photographer, and foodie. Always looking to explore off-the-beaten-path destinations and capture beautiful landscapes.',
    home_city: 'New York, USA',
    interests: ['Nature', 'Photography', 'Food', 'Adventure'],
    travel_style: ['Backpacker', 'Adventure'],
    budget_preference: 'Moderate',
    created_at: new Date().toISOString(),
  },
  {
    id: 'u2',
    email: 'priya@example.com',
    name: 'Priya Patel',
    profile_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
    bio: 'Yoga instructor and nature lover. Traveling to find peace, learn local history, and taste traditional cuisines.',
    home_city: 'Mumbai, India',
    interests: ['Nature', 'Food', 'History', 'Relaxation'],
    travel_style: ['Budget', 'Relaxed', 'Cultural'],
    budget_preference: 'Budget',
    created_at: new Date().toISOString(),
  },
  {
    id: 'u3',
    email: 'kenji@example.com',
    name: 'Kenji Sato',
    profile_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    bio: 'Software engineer on a sabbatical. Passionate about historical architecture, hiking, and exploring local night markets.',
    home_city: 'Tokyo, Japan',
    interests: ['Adventure', 'History', 'Culture', 'Nightlife'],
    travel_style: ['Backpacker', 'Fast-paced', 'Adventure'],
    budget_preference: 'Moderate',
    created_at: new Date().toISOString(),
  },
  {
    id: 'u4',
    email: 'sarah@example.com',
    name: 'Sarah Jenkins',
    profile_photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200',
    bio: 'Art historian and luxury travel blogger. I love exploring museums, cafes, and boutique shopping spots.',
    home_city: 'Paris, France',
    interests: ['Culture', 'Shopping', 'Food', 'Relaxation'],
    travel_style: ['Luxury', 'Relaxed'],
    budget_preference: 'Luxury',
    created_at: new Date().toISOString(),
  },
  {
    id: 'u5',
    email: 'rahul@example.com',
    name: 'Rahul Sharma',
    profile_photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    bio: 'Travel filmmaker. I love road trips, camping under the stars, and capturing local festivals on camera.',
    home_city: 'Delhi, India',
    interests: ['Photography', 'Adventure', 'Nature', 'Culture'],
    travel_style: ['Backpacker', 'Adventure', 'Fast-paced'],
    budget_preference: 'Budget',
    created_at: new Date().toISOString(),
  }
];

export const INITIAL_TRIPS: Trip[] = [
  {
    id: 't1',
    user_id: 'u2', // Priya
    destination: 'Goa, India',
    start_date: '2026-12-12',
    end_date: '2026-12-18',
    approximate_budget: 350,
    travel_interests: ['Nature', 'Food', 'Relaxation'],
    preferred_travel_style: ['Budget', 'Relaxed'],
    number_of_travelers: 2,
    description: 'Looking for a travel buddy to explore south Goa beaches, try local seafood shacks, and visit spice plantations. Keeping it laidback and budget-friendly.',
    created_at: new Date().toISOString(),
  },
  {
    id: 't2',
    user_id: 'u3', // Kenji
    destination: 'Manali, India',
    start_date: '2026-12-20',
    end_date: '2026-12-27',
    approximate_budget: 500,
    travel_interests: ['Nature', 'Adventure', 'History'],
    preferred_travel_style: ['Backpacker', 'Adventure'],
    number_of_travelers: 3,
    description: 'Planning to hike up to Jogini Waterfalls, explore Solang Valley, and try paragliding. Would love to share transport and cabin costs with fellow adventurers!',
    created_at: new Date().toISOString(),
  },
  {
    id: 't3',
    user_id: 'u4', // Sarah
    destination: 'Jaipur, India',
    start_date: '2026-11-05',
    end_date: '2026-11-10',
    approximate_budget: 1500,
    travel_interests: ['Culture', 'Shopping', 'History'],
    preferred_travel_style: ['Luxury', 'Cultural'],
    number_of_travelers: 2,
    description: 'Exploring the Pink City! Planning guided heritage walks, visiting Amber Palace, shopping for textiles, and staying at premium heritage hotels.',
    created_at: new Date().toISOString(),
  },
  {
    id: 't4',
    user_id: 'u5', // Rahul
    destination: 'Kerala, India',
    start_date: '2026-12-15',
    end_date: '2026-12-22',
    approximate_budget: 450,
    travel_interests: ['Photography', 'Nature', 'Culture'],
    preferred_travel_style: ['Backpacker', 'Relaxed'],
    number_of_travelers: 2,
    description: 'Strolling through tea gardens in Munnar and renting a houseboat in Alleppey. I will be filming a mini-documentary and would love a partner to explore with.',
    created_at: new Date().toISOString(),
  },
  {
    id: 't5',
    user_id: 'u2', // Priya
    destination: 'Bali, Indonesia',
    start_date: '2026-10-10',
    end_date: '2026-10-18',
    approximate_budget: 800,
    travel_interests: ['Nature', 'Relaxation', 'Culture'],
    preferred_travel_style: ['Relaxed', 'Cultural'],
    number_of_travelers: 1,
    description: 'Heading to Ubud for a wellness retreat, visiting temples, and hiking Mt. Batur for sunrise. Looking for someone traveling during similar dates.',
    created_at: new Date().toISOString(),
  }
];

export const INITIAL_REQUESTS: TravelRequest[] = [
  {
    id: 'req1',
    sender_id: 'u2', // Priya
    receiver_id: 'u1', // Alex (You)
    trip_id: 't1', // Goa Trip
    status: 'pending',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: 'req2',
    sender_id: 'u3', // Kenji
    receiver_id: 'u1', // Alex (You)
    trip_id: 't2', // Manali Trip
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
  }
];

export const INITIAL_CONNECTIONS: Connection[] = [
  {
    id: 'conn1',
    user1_id: 'u1', // Alex (You)
    user2_id: 'u5', // Rahul
    trip_id: 't4', // Kerala Trip
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    buddy: {
      id: 'u5',
      name: 'Rahul Sharma',
      profile_photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      bio: 'Travel filmmaker. I love road trips, camping under the stars, and capturing local festivals on camera.',
      interests: ['Photography', 'Adventure', 'Nature', 'Culture'],
      travel_style: ['Backpacker', 'Adventure', 'Fast-paced'],
    },
    shared_trip: {
      id: 't4',
      destination: 'Kerala, India',
      start_date: '2026-12-15',
      end_date: '2026-12-22',
      approximate_budget: 450,
      description: 'Strolling through tea gardens in Munnar and renting a houseboat in Alleppey.',
    }
  }
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    connection_id: 'conn1',
    sender_id: 'u5', // Rahul
    receiver_id: 'u1', // Alex (You)
    content: "Hey Alex! Thanks for connecting. I saw you're interested in photography. We should capture some drone shots at the tea gardens in Munnar!",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    is_read: true,
  },
  {
    id: 'm2',
    connection_id: 'conn1',
    sender_id: 'u1', // Alex (You)
    receiver_id: 'u5', // Rahul
    content: "Hey Rahul! That sounds incredible. I've got my mirrorless setup ready. Have you decided on which houseboat we should book in Alleppey?",
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    is_read: true,
  },
  {
    id: 'm3',
    connection_id: 'conn1',
    sender_id: 'u5', // Rahul
    receiver_id: 'u1', // Alex (You)
    content: "I have a couple of options shortlisted! One has a nice open upper deck. Let me send the links shortly. Are you fine with a moderate budget tier?",
    timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
    is_read: false,
  }
];

export const COMPANION_REPLIES: Record<string, string[]> = {
  u5: [
    "Perfect! I will double-check the bookings and call the houseboat operator.",
    "Awesome. By the way, are you planning to carry a tripod? I want to film some sunrise time-lapses.",
    "Nice! I will share the itinerary sheet on Google Drive. Talk to you soon!",
    "Hey! Just saw this. Let's touch base tomorrow to finalize the flight details."
  ],
  u2: [
    "Hey! Yes, I would love to explore Goa beaches together. Are you planning to rent a scooter?",
    "That sounds great! Let's definitely try that local fish curry place in south Goa.",
    "Awesome. I'm looking at hostels near Palolem beach, what do you think?",
    "Perfect, let's catch up on a quick call sometime this week!"
  ],
  u3: [
    "Hey there! Solang Valley is amazing during December. Ready for some winter sports?",
    "Nice! I'm planning to hire a local guide for the trek. Would you like to share the expense?",
    "Awesome. I'll get back to you with the transport options from Chandigarh.",
    "Got it! Let's book the stay details next week."
  ],
  u4: [
    "Hi Alex! Yes, Amber Fort is a must-visit. Let's arrange a private cab for the palace tours.",
    "Perfect. I have made reservations for dinner at a nice heritage rooftop restaurant.",
    "Great! Let know if you would like to visit the textile markets as well.",
    "Looking forward to our travel! Let's connect soon."
  ]
};
