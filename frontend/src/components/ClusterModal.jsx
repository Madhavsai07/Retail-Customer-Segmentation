import { FiUsers, FiX, FiRefreshCw, FiAlertTriangle, FiSearch } from 'react-icons/fi';

export default function ClusterModal({
  clusterId,
  onClose,
  modalData,
  modalLoading,
  modalError,
  onRetry,
  onInspectCustomer,
}) {
  if (clusterId === null) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiUsers className="text-primary-500" />
            Customers in Cluster {clusterId}
            {!modalLoading && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md ml-2">{modalData.length} total</span>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
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
                onClick={onRetry}
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
                           onClick={() => onInspectCustomer(c.CustomerID)}
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
  );
}

