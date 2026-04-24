import axios from 'axios';
import { supabase } from '../supabaseClient';

// ── Axios instance ────────────────────────────────────────────────────────────
// All API calls go through this. The base URL points to the FastAPI backend.
const API = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
});

// Automatically attach the Supabase JWT (access token from the active session)
API.interceptors.request.use(async (req) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    req.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return req;
});

// Log errors to the browser console
API.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API Error]', err?.response?.data || err.message);
    return Promise.reject(err);
  }
);

// ── API functions ─────────────────────────────────────────────────────────────

// Dashboard data
export const checkHealth = () => API.get('/health');
export const getMetrics = () => API.get('/metrics');
export const getSegments = (k = 4) => API.get(`/segment?k=${k}`);
export const getPersonas = (k = 4) => API.get(`/personas?k=${k}`);
export const getCustomer = (id, k = 4) => API.get(`/customer/${id}?k=${k}`);
export const getClusterCustomers = (clusterId, k = 4) => API.get(`/cluster/${clusterId}/customers?k=${k}`);
export const getCustomerTransactions = (id) => API.get(`/customer/${id}/transactions`);

// ── Fallback demo data (shown when the backend is offline) ────────────────────
// This lets the dashboard still display something useful if the server is down.

export const DUMMY_METRICS = {
  total_customers: 4338,
  avg_recency: 92.4,
  avg_frequency: 4.3,
  total_revenue: 9747748.2,
  best_k: 4,
  silhouette_scores: { 3: 0.312, 4: 0.381, 5: 0.357 },
};

export const DUMMY_CLUSTER_SUMMARY = {
  3: [
    { Cluster: 0, count: 1542, avg_recency: 30, avg_frequency: 7.2, avg_monetary: 3821 },
    { Cluster: 1, count: 1891, avg_recency: 110, avg_frequency: 3.1, avg_monetary: 1032 },
    { Cluster: 2, count: 905, avg_recency: 250, avg_frequency: 1.2, avg_monetary: 291 },
  ],
  4: [
    { Cluster: 0, count: 872, avg_recency: 22, avg_frequency: 8.2, avg_monetary: 4821 },
    { Cluster: 1, count: 1341, avg_recency: 68, avg_frequency: 4.1, avg_monetary: 1932 },
    { Cluster: 2, count: 1187, avg_recency: 142, avg_frequency: 2.3, avg_monetary: 891 },
    { Cluster: 3, count: 938, avg_recency: 214, avg_frequency: 1.4, avg_monetary: 342 },
  ],
  5: [
    { Cluster: 0, count: 654, avg_recency: 18, avg_frequency: 9.1, avg_monetary: 5200 },
    { Cluster: 1, count: 1021, avg_recency: 56, avg_frequency: 5.2, avg_monetary: 2400 },
    { Cluster: 2, count: 1100, avg_recency: 105, avg_frequency: 3.5, avg_monetary: 1400 },
    { Cluster: 3, count: 852, avg_recency: 168, avg_frequency: 1.8, avg_monetary: 700 },
    { Cluster: 4, count: 711, avg_recency: 250, avg_frequency: 1.1, avg_monetary: 250 },
  ],
};

// Random scatter data for the demo (200 sample customers)
const baseScatter = Array.from({ length: 200 }, (_, i) => ({
  CustomerID: 10000 + i,
  Recency: Math.round(Math.random() * 365),
  Frequency: Math.round(Math.random() * 20) + 1,
  Monetary: Math.round(Math.random() * 8000) + 200,
}));

export const DUMMY_SCATTER = {
  3: baseScatter.map(d => ({ ...d, Cluster: Math.floor(Math.random() * 3) })),
  4: baseScatter.map(d => ({ ...d, Cluster: Math.floor(Math.random() * 4) })),
  5: baseScatter.map(d => ({ ...d, Cluster: Math.floor(Math.random() * 5) })),
};

export const DUMMY_PERSONAS = {
  3: [
    {
      cluster_id: 0, persona_name: 'High Value', color: '#6366f1',
      description: 'Spend highly and frequently.',
      cluster_size: 1542, avg_recency: 30, avg_frequency: 7.2, avg_monetary: 3821,
      recommendations: ['Loyalty programs', 'VIP events'],
    },
    {
      cluster_id: 1, persona_name: 'Mid Value', color: '#06b6d4',
      description: 'Average spenders.',
      cluster_size: 1891, avg_recency: 110, avg_frequency: 3.1, avg_monetary: 1032,
      recommendations: ['Upsell', 'Cross-sell'],
    },
    {
      cluster_id: 2, persona_name: 'Low Value', color: '#10b981',
      description: 'Rarely buy.',
      cluster_size: 905, avg_recency: 250, avg_frequency: 1.2, avg_monetary: 291,
      recommendations: ['Winback emails', 'Discount offers'],
    },
  ],
  4: [
    {
      cluster_id: 0, persona_name: 'Champions', color: '#6366f1',
      description: 'High-Value & Highly Engaged Customers',
      cluster_size: 872, avg_recency: 22, avg_frequency: 8.2, avg_monetary: 4821,
      recommendations: ['Offer loyalty rewards', 'Invite to VIP program', 'Ask for product reviews'],
    },
    {
      cluster_id: 1, persona_name: 'Loyal Customers', color: '#06b6d4',
      description: 'Frequent & Consistent Customers',
      cluster_size: 1341, avg_recency: 68, avg_frequency: 4.1, avg_monetary: 1932,
      recommendations: ['Upsell higher-value products', 'Send personalised discounts', 'Enrol in membership'],
    },
    {
      cluster_id: 2, persona_name: 'Occasional Buyers', color: '#10b981',
      description: 'Low-Frequency, Moderate-Value Customers',
      cluster_size: 1187, avg_recency: 142, avg_frequency: 2.3, avg_monetary: 891,
      recommendations: ['Send re-engagement campaigns', 'Offer seasonal promotions', 'Highlight new arrivals'],
    },
    {
      cluster_id: 3, persona_name: 'At Risk', color: '#f59e0b',
      description: 'High-Recency, Low-Engagement Customers',
      cluster_size: 938, avg_recency: 214, avg_frequency: 1.4, avg_monetary: 342,
      recommendations: ['Send win-back email sequence', 'Offer strong discount', 'Survey to understand churn'],
    },
  ],
  5: [
    {
      cluster_id: 0, persona_name: 'Champions', color: '#6366f1',
      description: 'Top spenders, most recent.',
      cluster_size: 654, avg_recency: 18, avg_frequency: 9.1, avg_monetary: 5200,
      recommendations: ['VIP treatment', 'Early access'],
    },
    {
      cluster_id: 1, persona_name: 'Loyal Customers', color: '#06b6d4',
      description: 'Consistent spenders.',
      cluster_size: 1021, avg_recency: 56, avg_frequency: 5.2, avg_monetary: 2400,
      recommendations: ['Referral programs'],
    },
    {
      cluster_id: 2, persona_name: 'Potential Loyalists', color: '#10b981',
      description: 'Recent buyers with good spend.',
      cluster_size: 1100, avg_recency: 105, avg_frequency: 3.5, avg_monetary: 1400,
      recommendations: ['Loyalty program intro'],
    },
    {
      cluster_id: 3, persona_name: 'At Risk', color: '#f59e0b',
      description: 'Slipping engagement.',
      cluster_size: 852, avg_recency: 168, avg_frequency: 1.8, avg_monetary: 700,
      recommendations: ['Reactivation campaigns'],
    },
    {
      cluster_id: 4, persona_name: 'Hibernating', color: '#ec4899',
      description: 'Long time no see.',
      cluster_size: 711, avg_recency: 250, avg_frequency: 1.1, avg_monetary: 250,
      recommendations: ['Aggressive discounts'],
    },
  ],
};

// Generate a fake customer profile for the demo (when backend is offline)
export const getDummyCustomer = (id, k = 4) => {
  const cluster_id = Math.floor(Math.random() * k);
  const persona = DUMMY_PERSONAS[k]?.[cluster_id];
  return {
    customer_id: id,
    cluster_id,
    persona_name: persona?.persona_name || 'Unknown',
    recommendations: persona?.recommendations || [],
    metrics: { recency: 35, frequency: 5.2, monetary: 1540.50 },
    cluster_averages: { recency: 40, frequency: 4.8, monetary: 1300.00 },
  };
};

export const getDummyClusterCustomers = (clusterId, k = 4) => {
  // Return a mock list of exactly matching the shape returned by the backend
  const customers = DUMMY_SCATTER[k]
    .filter(c => c.Cluster === clusterId)
    .sort((a, b) => b.Monetary - a.Monetary)
    .map(c => ({
      CustomerID: c.CustomerID,
      Recency: c.Recency,
      Frequency: c.Frequency,
      Monetary: c.Monetary
    }));
    
  return {
    data: {
      cluster_id: clusterId,
      k: k,
      count: customers.length,
      customers: customers
    }
  };
};

export default API;
