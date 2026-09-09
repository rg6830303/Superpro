export type SkillLevel = "beginner" | "intermediate" | "advanced" | "pro";
export type PaymentMethod = "razorpay" | "cod" | "venue";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: "paddles" | "balls" | "grips" | "accessories";
  tagline: string | null;
  description: string | null;
  specs: string[];
  price_paise: number;
  compare_at_paise: number | null;
  image_url: string | null;
  gallery: string[];
  stock: number;
  featured: boolean;
  active: boolean;
  sort_order: number;
};

export type Venue = {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  courts: number;
  maps_url: string | null;
  active: boolean;
};

export type GameSession = {
  id: string;
  venue_id: string;
  venue_name?: string;
  venue_area?: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  court_number: number;
  level: "all" | "beginner" | "intermediate" | "advanced";
  capacity: number;
  price_paise: number;
  pricing_mode?: "fixed" | "split" | string;
  court_fee_paise?: number;
  status: "open" | "closed" | "cancelled";
  notes: string | null;
  whatsapp_posted_at: string | null;
  booked?: number;
};

export type GameRegistration = {
  id: string;
  session_id: string;
  player_name: string;
  player_phone: string;
  player_email: string | null;
  skill_level: SkillLevel;
  players_count: number;
  court_number: number | null;
  amount_paise: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: "confirmed" | "waitlist" | "cancelled";
  created_at: string;
};

export type Coach = {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  bio: string | null;
  specialties: string[];
  dupr: number | null;
  experience_years: number;
  rate_paise: number;
  languages: string | null;
  image_url: string | null;
  whatsapp: string | null;
  available_days: string[];
  active: boolean;
  sort_order: number;
};

export type Tournament = {
  id: string;
  slug: string;
  title: string;
  kind: "organized" | "sponsored";
  status: "announced" | "open" | "closed" | "completed" | "cancelled";
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  city: string;
  format: string | null;
  categories: string[];
  prize_pool_paise: number;
  entry_fee_paise: number;
  max_teams: number;
  dupr_cap: number | null;
  banner_url: string | null;
  summary: string | null;
  description: string | null;
  result_note: string | null;
  registration_open: boolean;
  partner_name: string | null;
  teams?: number;
};

export type TournamentRegistration = {
  id: string;
  tournament_id: string;
  group_id: string | null;
  group_name?: string | null;
  team_name: string;
  category: string | null;
  player1_name: string;
  player1_phone: string;
  player1_dupr: number | null;
  player2_name: string | null;
  player2_phone: string | null;
  player2_dupr: number | null;
  seed: number | null;
  amount_paise: number;
  payment_status: PaymentStatus;
  status: "pending" | "confirmed" | "waitlist" | "withdrawn";
  created_at: string;
};

export type CartLine = { product_id: string; slug: string; name: string; price_paise: number; qty: number; image_url: string | null };
