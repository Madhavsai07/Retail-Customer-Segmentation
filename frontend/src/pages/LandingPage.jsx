import { useNavigate } from 'react-router-dom';
import {
  FiDatabase, FiTarget, FiBarChart2, FiArrowRight,
  FiZap,
} from 'react-icons/fi';

const FEATURES = [
  {
    icon: <FiTarget className="text-primary-600" size={28} />,
    title: 'Customer Segmentation',
    desc: 'Automatically group customers into meaningful clusters using K-Means clustering algorithm for targeted marketing.',
    bg: 'bg-primary-50',
  },
  {
    icon: <FiDatabase className="text-accent-600" size={28} />,
    title: 'RFM Analysis',
    desc: 'Measure Recency, Frequency, and Monetary value to quantify customer engagement and purchasing behaviour.',
    bg: 'bg-accent-50',
  },
  {
    icon: <FiBarChart2 className="text-emerald-600" size={28} />,
    title: 'Business Insights',
    desc: 'Turn raw transaction data into actionable personas with personalised recommendations for each segment.',
    bg: 'bg-emerald-50',
  },
];





export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-accent-500 rounded-lg flex items-center justify-center">
              <FiBarChart2 className="text-white" size={16} />
            </div>
            <span className="font-bold text-gray-900 text-lg">Retail<span className="gradient-text">IQ</span></span>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary text-sm py-2 px-5"
          >
            Login to Dashboard
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-br from-gray-50 via-primary-50/40 to-accent-50/30 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-accent-200/30 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in">
          <span className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <FiZap size={12} /> Powered by K-Means + RFM Analytics
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Retail Customer{' '}
            <span className="gradient-text">Segmentation</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Analyse customer behaviour using RFM analytics and machine learning.
            Discover meaningful customer personas, improve targeting, and drive revenue growth.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary flex items-center gap-2 text-base px-8 py-4"
            >
              Explore Segmentation <FiArrowRight size={18} />
            </button>
            <a
              href="#features"
              className="btn-secondary text-base px-8 py-4"
            >
              Learn More
            </a>
          </div>

        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Core Features</h2>
          <p className="text-gray-500 mt-2">Everything you need to understand your customers</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="card hover:shadow-lg transition-shadow duration-200 group">
              <div className={`w-14 h-14 ${f.bg} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>





      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 bg-gradient-to-br from-primary-600 to-accent-500 rounded-md flex items-center justify-center">
            <FiBarChart2 className="text-white" size={12} />
          </div>
          <span className="font-bold text-gray-700">Retail<span className="gradient-text">IQ</span></span>
        </div>
        <p className="text-xs text-gray-400">
          © 2026 RetailIQ — Retail Customer Segmentation · Built with FastAPI + React + Scikit-Learn
        </p>
      </footer>
    </div>
  );
}
