import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBarChart2, FiUsers, FiLayers, FiActivity, FiBookmark,
  FiLogOut, FiRefreshCw, FiFilter, FiClock, FiShoppingCart,
  FiDollarSign, FiMenu, FiX, FiChevronRight, FiAlertTriangle, FiSearch, FiDownload
} from 'react-icons/fi';
import KPIBox from '../components/KPIBox';
import ClusterChart from '../components/ClusterChart';
import ScatterPlot from '../components/ScatterPlot';
import PersonaCard from '../components/PersonaCard';
import {
  getMetrics, getSegments, getPersonas, getCustomer, getDummyCustomer,
  getClusterCustomers, getDummyClusterCustomers, getCustomerTransactions,
  getAnalysisStatus, getPipelineStatus, uploadDataset, downloadFile,
  DUMMY_METRICS, DUMMY_CLUSTER_SUMMARY, DUMMY_SCATTER, DUMMY_PERSONAS,
} from '../api/api';
import { supabase } from '../supabaseClient';

const NAV_ITEMS = [
  { id: 'overview', icon: <FiBarChart2 size={18} />, label: 'Dashboard' },
  { id: 'personas', icon: <FiBookmark size={18} />, label: 'Recommendations' },
  { id: 'search', icon: <FiSearch size={18} />, label: 'Customer Search' }
];

const K_OPTIONS = [3, 4, 5];

function formatCurrency(v) {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `£${(v / 1_000).toFixed(1)}K`;
  return `£${Number(v).toFixed(0)}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('user@retail.com');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email);
    });
  }, []);

  const [activeSection, setActiveSection] = useState('overview');
  const [selectedK, setSelectedK] = useState(4);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [metrics, setMetrics] = useState(null);
  const [clusterSummary, setClusterSummary] = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [silhouette, setSilhouette] = useState({});
  const [loading, setLoading] = useState(true);
  const [backendUp, setBackendUp] = useState(false);

  const [hasAnalysis, setHasAnalysis] = useState(null);
  const [pipelineProgress, setPipelineProgress] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pollIntervalId, setPollIntervalId] = useState(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [filterCluster, setFilterCluster] = useState('all');
  const [topN, setTopN] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [transactions, setTransactions] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showAllTx, setShowAllTx] = useState(false);

  const [modalCluster, setModalCluster] = useState(null);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const checkUserAnalysisStatus = useCallback(async () => {
    try {
      const res = await getAnalysisStatus();
      setBackendUp(true);
      if (res.data.has_analysis) {
        setHasAnalysis(true);
        return true;
      } else {
        setHasAnalysis(false);
        return false;
      }
    } catch (err) {
      console.error('Failed to get analysis status:', err);
      setBackendUp(false);
      setHasAnalysis(true);
      return true;
    }
  }, []);

  const getTop3K = useCallback(() => {
    if (!metrics || !metrics.silhouette_scores) {
      return [
        { k: 4, score: 0.381 },
        { k: 5, score: 0.357 },
        { k: 3, score: 0.312 }
      ];
    }
    const scores = metrics.silhouette_scores;
    const sorted = Object.entries(scores)
      .map(([k, score]) => ({ k: Number(k), score: Number(score) }))
      .sort((a, b) => b.score - a.score);
    return sorted.slice(0, 3);
  }, [metrics]);

  const fetchData = useCallback(async (k) => {
    setLoading(true);
    try {
      const isReady = await checkUserAnalysisStatus();
      if (!isReady) {
        setLoading(false);
        return;
      }

      const [mRes, sRes, pRes] = await Promise.all([
        getMetrics().catch(() => null),
        getSegments(k).catch(() => null),
        getPersonas(k).catch(() => null),
      ]);

      if (mRes) {
        setMetrics(mRes.data);
        setSilhouette(mRes.data.silhouette_scores || {});
        setBackendUp(true);
        if (!initialLoaded) {
          setSelectedK(mRes.data.best_k);
          setInitialLoaded(true);
        }
      } else {
        setMetrics(DUMMY_METRICS);
        setSilhouette(DUMMY_METRICS.silhouette_scores);
        setBackendUp(false);
        if (!initialLoaded) {
          setSelectedK(DUMMY_METRICS.best_k);
          setInitialLoaded(true);
        }
      }

      if (sRes) {
        setClusterSummary(sRes.data.cluster_summary || []);
        setScatterData(sRes.data.scatter_data || []);
      } else {
        setClusterSummary(DUMMY_CLUSTER_SUMMARY[k] || []);
        setScatterData(DUMMY_SCATTER[k] || []);
      }

      if (pRes) {
        setPersonas(pRes.data.personas || []);
      } else {
        setPersonas(DUMMY_PERSONAS[k] || []);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
      setMetrics(DUMMY_METRICS);
      setClusterSummary(DUMMY_CLUSTER_SUMMARY[k] || []);
      setScatterData(DUMMY_SCATTER[k] || []);
      setPersonas(DUMMY_PERSONAS[k] || []);
    } finally {
      setLoading(false);
    }
  }, [checkUserAnalysisStatus, initialLoaded]);

  useEffect(() => { fetchData(selectedK); }, [selectedK, fetchData]);

  useEffect(() => {
    return () => {
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, [pollIntervalId]);

  const startPipelinePolling = () => {
    const interval = setInterval(async () => {
      try {
        const res = await getPipelineStatus();
        setPipelineProgress(res.data);
        if (res.data.status === 'complete') {
          clearInterval(interval);
          setShowUploadModal(false);
          setUploading(false);
          setPipelineProgress(null);
          setInitialLoaded(false);
          fetchData(selectedK);
        } else if (res.data.status === 'error') {
          clearInterval(interval);
          setUploadError(res.data.error || 'Pipeline run failed.');
          setUploading(false);
        }
      } catch (err) {
        console.error('Error checking pipeline status:', err);
      }
    }, 2000);
    return interval;
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    setPipelineProgress({
      status: 'running',
      step: 'Uploading dataset...',
      progress: 5,
      error: null
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      await uploadDataset(formData);
      const id = startPipelinePolling();
      setPollIntervalId(id);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.detail || 'Failed to upload dataset. Check format and contents.');
      setUploading(false);
      setPipelineProgress(null);
    }
  };

  const handleDownload = async (type) => {
    try {
      const res = await downloadFile(type);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      
      let filename = 'download.csv';
      if (type === 'clustered_csv') filename = 'clustered_transactions.csv';
      else if (type === 'rfm_table') filename = 'rfm_features.csv';
      else if (type === 'cluster_summary') filename = 'cluster_summary.csv';

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const performSearch = async (query) => {
    if (!query || !query.toString().trim()) return;
    setSearchLoading(true);
    setSearchError('');
    setSearchResult(null);
    setTransactions([]);
    setTopProducts([]);
    setShowAllTx(false);
    try {
      if (backendUp) {
        const [customerRes, txRes] = await Promise.all([
          getCustomer(query.toString().trim(), selectedK),
          getCustomerTransactions(query.toString().trim()).catch(() => null),
        ]);
        setSearchResult(customerRes.data);
        if (txRes) {
          setTransactions(txRes.data.transactions || []);
          setTopProducts(txRes.data.top_products || []);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 600));
        setSearchResult(getDummyCustomer(query.toString().trim(), selectedK));
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setSearchError('Customer not found in the dataset.');
      } else {
        setSearchError('Failed to retrieve customer data.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    await performSearch(searchQuery);
  };

  const handleClusterClick = async (clusterId) => {
    setModalCluster(clusterId);
    setModalLoading(true);
    setModalError('');
    setModalData([]);
    try {
      if (backendUp) {
        const res = await getClusterCustomers(clusterId, selectedK);
        setModalData(res.data.customers || []);
      } else {
        await new Promise(resolve => setTimeout(resolve, 400));
        const res = getDummyClusterCustomers(clusterId, selectedK);
        setModalData(res.data.customers || []);
      }
    } catch (error) {
      console.error('Failed to load customers for cluster', error);
      setModalError('Failed to load customer list. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResult(null);
      setSearchError('');
    }
  }, [searchQuery]);

  const filteredScatter = filterCluster === 'all'
    ? scatterData.slice(0, topN)
    : scatterData.filter((d) => d.Cluster === Number(filterCluster)).slice(0, topN);

  const Sidebar = (
    <aside className={`
      fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex flex-col
      transition-transform duration-300
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0 lg:static lg:flex
    `}>
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-accent-500 rounded-lg flex items-center justify-center">
            <FiBarChart2 className="text-white" size={15} />
          </div>
          <span className="font-bold text-gray-900">Retail<span className="gradient-text">IQ</span></span>
        </div>
        <button
          className="ml-auto lg:hidden text-gray-400 hover:text-gray-600"
          onClick={() => setSidebarOpen(false)}
        >
          <FiX size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
            className={`sidebar-link w-full ${activeSection === item.id ? 'active' : ''}`}
          >
            {item.icon}
            {item.label}
            {activeSection === item.id && <FiChevronRight size={14} className="ml-auto" />}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{userEmail}</p>
            <p className="text-[10px] text-gray-400">Admin</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-500 transition-colors w-full"
        >
          <FiLogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      {Sidebar}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 gap-4 sticky top-0 z-20">
          <button
            className="lg:hidden text-gray-400 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
            id="sidebar-toggle"
          >
            <FiMenu size={22} />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-base">
              {NAV_ITEMS.find((n) => n.id === activeSection)?.label || 'Dashboard'}
            </h1>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              {backendUp ? (
                <span>🟢 Backend connected</span>
              ) : (
                <>
                  <span>🟡 Using demo data (backend offline)</span>
                  <button onClick={() => fetchData(selectedK)} className="text-primary-600 font-semibold hover:underline">
                    Reconnect
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden sm:block">Segments</span>
              <select
                id="k-select"
                value={selectedK}
                onChange={(e) => setSelectedK(Number(e.target.value))}
                className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm cursor-pointer"
              >
                {getTop3K().map(({ k, score }) => (
                  <option key={k} value={k}>
                    K = {k} | Silhouette = {score.toFixed(3)}{k === metrics?.best_k ? ' (Recommended)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {silhouette[selectedK] && (
              <span className="bg-primary-50 border border-primary-100 text-primary-700 text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-1">
                <FiActivity size={11} />
                Score: {silhouette[selectedK]}
              </span>
            )}
            {backendUp && (
              <>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-outline flex items-center gap-1.5 text-xs text-primary-600 border-primary-200 bg-primary-50/30 hover:bg-primary-50 hover:text-primary-700"
                  id="upload-new-btn"
                >
                  <FiLayers size={13} />
                  Upload New Data
                </button>
                <div className="relative group">
                  <button
                    className="btn-outline flex items-center gap-1.5 text-xs text-gray-600 border-gray-200 bg-white hover:bg-gray-50"
                    id="export-dropdown-btn"
                  >
                    <FiDownload size={13} />
                    Export Data
                  </button>
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-30">
                    <div className="p-1">
                      <button
                        onClick={() => handleDownload('clustered_csv')}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 font-medium"
                      >
                        <span>📊</span> Clustered Transactions
                      </button>
                      <button
                        onClick={() => handleDownload('rfm_table')}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 font-medium"
                      >
                        <span>📈</span> RFM Features Table
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
            <button
              onClick={() => fetchData(selectedK)}
              className="btn-outline flex items-center gap-1.5 text-xs"
              id="refresh-btn"
            >
              <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-screen-2xl mx-auto w-full">

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading segmentation data…</p>
              </div>
            </div>
          )}

          {!loading && hasAnalysis === false && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-xl mx-auto text-center px-4">
              <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-primary-100">
                <FiLayers size={28} />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">No Customer Analysis Found</h2>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                Upload your retail transaction dataset (CSV or Excel) to clean your data, engineer RFM features, evaluate optimal clustering, and discover customer personas automatically.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm"
              >
                Upload Transaction Dataset
              </button>
            </div>
          )}

          {!loading && hasAnalysis !== false && (
            <>
              <section className="mb-8">
                <div className="flex flex-wrap gap-4">
                  <KPIBox
                    title="Total Customers"
                    value={metrics?.total_customers?.toLocaleString() ?? '—'}
                    subtitle="Unique customer IDs"
                    icon={<FiUsers />}
                    iconBg="bg-primary-100"
                    iconColor="text-primary-600"
                    trend="up"
                    trendLabel="+8% MoM"
                  />
                  <KPIBox
                    title="Avg Recency"
                    value={`${metrics?.avg_recency ?? '—'} d`}
                    subtitle="Days since last purchase"
                    icon={<FiClock />}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                    trend="neutral"
                    trendLabel="stable"
                  />
                  <KPIBox
                    title="Avg Frequency"
                    value={metrics?.avg_frequency ?? '—'}
                    subtitle="Orders per customer"
                    icon={<FiShoppingCart />}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                    trend="up"
                    trendLabel="+5%"
                  />
                  <KPIBox
                    title="Total Revenue"
                    value={metrics ? formatCurrency(metrics.total_revenue) : '—'}
                    subtitle="Sum of all transactions"
                    icon={<FiDollarSign />}
                    iconBg="bg-accent-100"
                    iconColor="text-accent-600"
                    trend="up"
                    trendLabel="+12% YoY"
                  />
                </div>
              </section>

              {(activeSection === 'overview' || activeSection === 'segments' || activeSection === 'rfm') && (
                <>
                  <section className="mb-6 card py-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <FiFilter size={14} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">Filters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500" htmlFor="filter-cluster">Cluster</label>
                        <select
                           id="filter-cluster"
                           value={filterCluster}
                           onChange={(e) => setFilterCluster(e.target.value)}
                           className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        >
                          <option value="all">All Clusters</option>
                          {Array.from({ length: selectedK }, (_, i) => {
                            const pName = personas.find(p => p.cluster_id === i)?.persona_name || `Cluster ${i}`;
                            return <option key={i} value={i}>{pName}</option>;
                          })}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500" htmlFor="filter-topn">Show</label>
                        <select
                           id="filter-topn"
                           value={topN}
                           onChange={(e) => setTopN(Number(e.target.value))}
                           className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        >
                          {[50, 100, 200, 500].map((n) => (
                            <option key={n} value={n}>Top {n}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    <ScatterPlot data={filteredScatter} k={selectedK} personas={personas} />
                    <ClusterChart data={clusterSummary} personas={personas} />
                  </div>

                  <section className="card mb-8">
                    <h3 className="text-base font-semibold text-gray-800 mb-4">Cluster RFM Summary</h3>
                    <div className="overflow-x-auto -mx-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {['Cluster', 'Customers', 'Avg Recency (d)', 'Avg Frequency', 'Avg Monetary (£)'].map((h) => (
                              <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2.5">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {clusterSummary.slice().sort((a,b) => b.avg_monetary - a.avg_monetary).map((row, i) => {
                            const pName = personas.find(p => p.cluster_id === row.Cluster)?.persona_name || `Cluster ${row.Cluster}`;
                            return (
                              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-3">
                                  <span className="badge bg-primary-100 text-primary-700">{pName}</span>
                                </td>
                                <td className="px-3 py-3 font-medium text-gray-800">{row.count?.toLocaleString()}</td>
                                <td className="px-3 py-3 text-gray-600">{Number(row.avg_recency).toFixed(1)}</td>
                                <td className="px-3 py-3 text-gray-600">{Number(row.avg_frequency).toFixed(1)}</td>
                                <td className="px-3 py-3 text-gray-600">£{Number(row.avg_monetary).toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {backendUp && (
                    <section className="card mb-8 py-5 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-white">
                      <div>
                        <h4 className="text-sm font-bold text-gray-800">Export Analysis Results</h4>
                        <p className="text-xs text-gray-400 mt-0.5">Download full datasets and segmented cluster reports in CSV format</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        <button
                          onClick={() => handleDownload('clustered_csv')}
                          className="btn-outline flex items-center justify-center gap-1.5 text-xs py-2 px-3 text-gray-700 hover:text-primary-600 flex-1 sm:flex-none"
                        >
                          ⬇ Clustered CSV
                        </button>
                        <button
                          onClick={() => handleDownload('rfm_table')}
                          className="btn-outline flex items-center justify-center gap-1.5 text-xs py-2 px-3 text-gray-700 hover:text-primary-600 flex-1 sm:flex-none"
                        >
                          ⬇ RFM Table
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}

              {(activeSection === 'overview' || activeSection === 'personas') && (
                <section>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-base font-semibold text-gray-800">Customer Personas</h2>
                      <p className="text-xs text-gray-400 mt-0.5">{selectedK} distinct behaviour groups · tailored recommendations per segment</p>
                    </div>
                  </div>
                  {personas.length === 0 ? (
                    <div className="flex items-center justify-center h-32 card text-gray-400 text-sm gap-2">
                      <FiAlertTriangle /> No persona data available for {selectedK} groups
                    </div>
                  ) : (
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                      {personas.slice().sort((a, b) => b.avg_monetary - a.avg_monetary).map((p) => (
                        <PersonaCard key={p.cluster_id} persona={p} onClick={handleClusterClick} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeSection === 'search' && (
                <section>
                  <div className="card mb-6 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Search Customer Profile</h2>
                    <form onSubmit={handleSearch} className="flex gap-3 max-w-md">
                      <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="number"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Enter Customer ID (e.g., 17850)"
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow text-sm"
                        />
                      </div>
                      <button type="submit" className="bg-primary-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-primary-700 transition flex items-center gap-2" disabled={searchLoading}>
                        {searchLoading ? <FiRefreshCw className="animate-spin" /> : 'Search'}
                      </button>
                    </form>
                    {searchError && <p className="text-red-500 text-sm mt-3">{searchError}</p>}
                  </div>

                  {searchResult && (
                    <div className="space-y-6">
                      <div className="card bg-gradient-to-r from-primary-50 to-white flex items-center gap-4 py-5 px-6">
                        <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold text-xl">
                          <FiUsers />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">Customer {searchResult.customer_id}</h3>
                          <div className="flex gap-2 mt-2">
                            <span className="bg-primary-100 text-primary-700 text-xs font-semibold px-2 py-1 rounded-md">Cluster {searchResult.cluster_id}</span>
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-1 rounded-md">{searchResult.persona_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-6">
                        <KPIBox
                          title="Recency"
                          value={`${searchResult.metrics.recency} d`}
                          subtitle={`Cluster Avg: ${searchResult.cluster_averages.recency} d`}
                          icon={<FiClock />} iconBg="bg-blue-100" iconColor="text-blue-600"
                          trend={searchResult.metrics.recency <= searchResult.cluster_averages.recency ? 'up' : 'down'}
                          trendLabel={searchResult.metrics.recency <= searchResult.cluster_averages.recency ? 'Better' : 'Worse'}
                        />
                        <KPIBox
                          title="Frequency"
                          value={searchResult.metrics.frequency}
                          subtitle={`Cluster Avg: ${searchResult.cluster_averages.frequency}`}
                          icon={<FiShoppingCart />} iconBg="bg-emerald-100" iconColor="text-emerald-600"
                          trend={searchResult.metrics.frequency >= searchResult.cluster_averages.frequency ? 'up' : 'down'}
                          trendLabel={searchResult.metrics.frequency >= searchResult.cluster_averages.frequency ? 'Better' : 'Worse'}
                        />
                        <KPIBox
                          title="Total Spend"
                          value={`£${searchResult.metrics.monetary}`}
                          subtitle={`Cluster Avg: £${searchResult.cluster_averages.monetary}`}
                          icon={<FiDollarSign />} iconBg="bg-amber-100" iconColor="text-amber-600"
                          trend={searchResult.metrics.monetary >= searchResult.cluster_averages.monetary ? 'up' : 'down'}
                          trendLabel={searchResult.metrics.monetary >= searchResult.cluster_averages.monetary ? 'Better' : 'Worse'}
                        />
                      </div>

                      {(transactions.length > 0 || txLoading) && (
                        <div className="card p-0 overflow-hidden">
                          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                            <div>
                              <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <FiShoppingCart className="text-primary-500" />
                                Customer Purchase History
                              </h4>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {transactions.length} transactions found · showing {showAllTx ? transactions.length : Math.min(12, transactions.length)} most recent
                              </p>
                            </div>
                            {transactions.length > 12 && (
                              <button
                                 onClick={() => setShowAllTx(v => !v)}
                                 className="text-xs font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                {showAllTx ? 'Show Less' : `Show All ${transactions.length}`}
                              </button>
                            )}
                          </div>

                          {txLoading ? (
                            <div className="flex items-center justify-center h-32 text-gray-400">
                              <FiRefreshCw className="animate-spin mr-2" /> Loading transactions…
                            </div>
                          ) : (
                            <div className="overflow-x-auto max-h-80 overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50 text-slate-500 text-xs uppercase tracking-wider z-10">
                                  <tr>
                                    <th className="px-5 py-3 text-left border-b border-gray-100">Date</th>
                                    <th className="px-5 py-3 text-left border-b border-gray-100">Product</th>
                                    <th className="px-5 py-3 text-right border-b border-gray-100">Qty</th>
                                    <th className="px-5 py-3 text-right border-b border-gray-100">Unit Price</th>
                                    <th className="px-5 py-3 text-right border-b border-gray-100">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {(showAllTx ? transactions : transactions.slice(0, 12)).map((tx, i) => {
                                    const isRecent = i < 3;
                                    return (
                                      <tr
                                        key={i}
                                        className={`transition-colors hover:bg-primary-50/40 ${
                                          isRecent ? 'bg-emerald-50/40' : 'bg-white'
                                        }`}
                                      >
                                        <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">
                                          {isRecent && (
                                            <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2 align-middle" />
                                          )}
                                          {tx.InvoiceDate}
                                        </td>
                                        <td className="px-5 py-2.5 text-gray-700 max-w-xs">
                                          <span className="line-clamp-1" title={tx.Description}>
                                            {tx.Description}
                                          </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-right font-medium text-gray-700">{tx.Quantity.toLocaleString()}</td>
                                        <td className="px-5 py-2.5 text-right text-gray-500">£{tx.UnitPrice.toFixed(2)}</td>
                                        <td className="px-5 py-2.5 text-right font-semibold text-emerald-700">
                                          £{tx.TotalPrice.toFixed(2)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {!txLoading && transactions.length === 0 && backendUp && (
                        <div className="card flex items-center gap-3 py-5 px-6 text-gray-400 text-sm border-dashed">
                          <FiAlertTriangle className="text-amber-400" size={18} />
                          No purchase history available for this customer.
                        </div>
                      )}

                      {topProducts.length > 0 && (
                        <div className="card p-6">
                          <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FiBarChart2 className="text-accent-500" />
                            Top Products Bought by This Customer
                          </h4>
                          <div className="space-y-3">
                            {(() => {
                              const maxQty = topProducts[0]?.total_qty || 1;
                              return topProducts.map((p, i) => {
                                const pct = Math.round((p.total_qty / maxQty) * 100);
                                const colors = [
                                  'from-primary-500 to-primary-400',
                                  'from-accent-500 to-accent-400',
                                  'from-emerald-500 to-emerald-400',
                                  'from-amber-500 to-amber-400',
                                  'from-rose-500 to-rose-400',
                                ];
                                return (
                                  <div key={i}>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-gray-700 font-medium truncate max-w-[70%]" title={p.product}>
                                        {i + 1}. {p.product}
                                      </span>
                                      <span className="text-gray-500 font-semibold">{p.total_qty.toLocaleString()} units</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                         className={`h-full rounded-full bg-gradient-to-r ${colors[i]} transition-all duration-700`}
                                         style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {searchResult.recommendations && searchResult.recommendations.length > 0 && (
                        <div className="card mt-2 p-6">
                          <h4 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
                            <FiBookmark className="text-primary-500" />
                            Targeted Actions for {searchResult.persona_name}
                          </h4>
                          <ul className="space-y-2">
                            {searchResult.recommendations.map((rec, i) => (
                              <li key={i} className="flex gap-3 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 items-start">
                                <span className="text-primary-500 font-bold mt-0.5">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] animate-slide-up overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FiLayers className="text-primary-500" />
                  Upload Transaction Data
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">CSV or Excel format with customer purchase records</p>
              </div>
              {!uploading && (
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                >
                  <FiX size={20} />
                </button>
              )}
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {!uploading ? (
                <>
                  <label className="border-2 border-dashed border-gray-200 hover:border-primary-400 bg-gray-50/50 hover:bg-primary-50/10 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files[0])}
                    />
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors mb-4">
                      <FiLayers size={22} />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Click to upload or drag & drop</p>
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      Supports .csv, .xlsx, .xls files.<br />
                      Must contain columns: <span className="font-semibold text-gray-600">CustomerID, InvoiceDate, Quantity, UnitPrice</span>
                    </p>
                  </label>

                  {uploadError && (
                    <div className="bg-red-50 border border-red-100 text-red-700 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5">
                      <FiAlertTriangle className="text-red-500 shrink-0 mt-0.5" size={14} />
                      <div>
                        <p className="font-semibold">Upload Failed</p>
                        <p className="mt-0.5 text-red-600 leading-relaxed">{uploadError}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  <div className="text-center space-y-3">
                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
                      <FiActivity className="text-primary-600 animate-pulse" size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{pipelineProgress?.step || 'Running ML Pipeline...'}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Please keep this window open while we run the analysis</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-gray-500">
                      <span>Overall Progress</span>
                      <span>{pipelineProgress?.progress || 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all duration-500 rounded-full"
                        style={{ width: `${pipelineProgress?.progress || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30 space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pipeline Stages</span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-gray-600">
                        <span className="flex items-center gap-2">
                          {pipelineProgress?.progress > 20 ? '✅' : '⏳'} 1. Clean Data
                        </span>
                        {pipelineProgress?.cleaning_summary && (
                          <span className="text-xs font-medium text-gray-400">
                            {pipelineProgress.cleaning_summary.final_rows?.toLocaleString()} rows
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-gray-600 gap-2">
                        {pipelineProgress?.progress > 40 ? '✅' : '⏳'} 2. Compute RFM Features
                      </div>
                      <div className="flex items-center text-gray-600 gap-2">
                        {pipelineProgress?.progress > 60 ? '✅' : '⏳'} 3. Find Optimal Clusters
                      </div>
                      <div className="flex items-center text-gray-600 gap-2">
                        {pipelineProgress?.progress > 80 ? '✅' : '⏳'} 4. Train K-Means Model
                      </div>
                      <div className="flex items-center text-gray-600 gap-2">
                        {pipelineProgress?.progress >= 100 ? '✅' : '⏳'} 5. Generate Personas
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modalCluster !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FiUsers className="text-primary-500" />
                Customers in Cluster {modalCluster}
                {!modalLoading && (
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md ml-2">{modalData.length} total</span>
                )}
              </h3>
              <button onClick={() => setModalCluster(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <FiX size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/50">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <FiRefreshCw className="animate-spin mb-2" size={24} />
                  <p className="text-sm">Loading customer list...</p>
                </div>
              ) : modalError ? (
                <div className="flex flex-col items-center justify-center py-16 text-red-500 bg-white rounded-xl border border-dashed border-red-200">
                  <FiAlertTriangle size={48} className="text-red-200 mb-4" />
                  <p className="text-lg font-medium">{modalError}</p>
                  <button 
                    onClick={() => handleClusterClick(modalCluster)}
                    className="mt-4 text-sm font-semibold text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <FiRefreshCw size={14} /> Try again
                  </button>
                </div>
              ) : modalData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                  <FiUsers size={48} className="text-gray-200 mb-4" />
                  <p className="text-lg font-medium text-gray-700">No customers scattered here</p>
                  <p className="text-sm mt-1 text-gray-400 text-center max-w-sm">We couldn't track down any customers matching this cluster setup.</p>
                </div>
              ) : (
                <div className="bg-white border text-left border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-4 border-b border-gray-100 text-left">Customer ID</th>
                        <th className="px-5 py-4 border-b border-gray-100 text-right">Recency (Days)</th>
                        <th className="px-5 py-4 border-b border-gray-100 text-right">Frequency</th>
                        <th className="px-5 py-4 border-b border-gray-100 text-right">Monetary (£)</th>
                        <th className="px-5 py-4 border-b border-gray-100 text-center">Take Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 overflow-y-auto">
                      {modalData.map(c => (
                        <tr key={c.CustomerID} className="hover:bg-indigo-50/40 focus-within:bg-indigo-50 transition-colors group">
                          <td className="px-5 py-3 font-semibold text-gray-700">
                            <span className="bg-gray-100 text-gray-600 rounded-md px-2 py-1 text-xs">{c.CustomerID}</span>
                          </td>
                          <td className="px-5 py-3 text-right text-gray-600 font-medium">{Number(c.Recency).toLocaleString()}d</td>
                          <td className="px-5 py-3 text-right text-gray-600">{Number(c.Frequency).toLocaleString()}x</td>
                          <td className="px-5 py-3 text-right text-emerald-600 font-semibold tracking-tight">£{Number(c.Monetary).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="px-5 py-3 text-center">
                            <button
                               onClick={() => {
                                 setModalCluster(null);
                                 setSearchQuery(c.CustomerID.toString());
                                 setActiveSection('search');
                                 performSearch(c.CustomerID);
                               }}
                               className="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full font-medium transition-colors inline-flex items-center justify-center gap-1.5 w-full opacity-80 group-hover:opacity-100"
                            >
                               <FiSearch size={12} /> Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
