import { useState, useEffect, useCallback, useMemo } from 'react';
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
import UploadModal from '../components/UploadModal';
import ClusterModal from '../components/ClusterModal';
import CustomerSearch from '../components/CustomerSearch';
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

  const filteredScatter = useMemo(() => {
    return filterCluster === 'all'
      ? scatterData.slice(0, topN)
      : scatterData.filter((d) => d.Cluster === Number(filterCluster)).slice(0, topN);
  }, [filterCluster, scatterData, topN]);

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
                  />
                  <KPIBox
                    title="Avg Recency"
                    value={`${metrics?.avg_recency ?? '—'} d`}
                    subtitle="Days since last purchase"
                    icon={<FiClock />}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                  />
                  <KPIBox
                    title="Avg Frequency"
                    value={metrics?.avg_frequency ?? '—'}
                    subtitle="Orders per customer"
                    icon={<FiShoppingCart />}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                  />
                  <KPIBox
                    title="Total Revenue"
                    value={metrics ? formatCurrency(metrics.total_revenue) : '—'}
                    subtitle="Sum of all transactions"
                    icon={<FiDollarSign />}
                    iconBg="bg-accent-100"
                    iconColor="text-accent-600"
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
                <CustomerSearch
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchResult={searchResult}
                  searchLoading={searchLoading}
                  searchError={searchError}
                  onSearch={handleSearch}
                  transactions={transactions}
                  topProducts={topProducts}
                  txLoading={txLoading}
                  showAllTx={showAllTx}
                  setShowAllTx={setShowAllTx}
                  backendUp={backendUp}
                />
              )}
            </>
          )}
        </main>
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        uploading={uploading}
        uploadError={uploadError}
        pipelineProgress={pipelineProgress}
        onFileUpload={handleFileUpload}
      />

      <ClusterModal
        clusterId={modalCluster}
        onClose={() => setModalCluster(null)}
        modalData={modalData}
        modalLoading={modalLoading}
        modalError={modalError}
        onRetry={() => handleClusterClick(modalCluster)}
        onInspectCustomer={(customerId) => {
          setModalCluster(null);
          setSearchQuery(customerId.toString());
          setActiveSection('search');
          performSearch(customerId);
        }}
      />
    </div>
  );
}
