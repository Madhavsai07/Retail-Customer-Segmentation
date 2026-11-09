import {
  FiUsers, FiClock, FiShoppingCart, FiDollarSign,
  FiSearch, FiRefreshCw, FiAlertTriangle, FiBarChart2, FiBookmark
} from 'react-icons/fi';
import KPIBox from './KPIBox';

export default function CustomerSearch({
  searchQuery,
  setSearchQuery,
  searchResult,
  searchLoading,
  searchError,
  onSearch,
  transactions = [],
  topProducts = [],
  txLoading,
  showAllTx,
  setShowAllTx,
  backendUp,
}) {
  return (
    <section>
      <div className="card mb-6 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Search Customer Profile</h2>
        <form onSubmit={onSearch} className="flex gap-3 max-w-md">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Customer ID (e.g., 17850)"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow text-sm"
            />
          </div>
          <button
            type="submit"
            className="bg-primary-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-primary-700 transition flex items-center gap-2"
            disabled={searchLoading}
          >
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
                            <td className="px-5 py-2.5 text-right font-medium text-gray-700">{Number(tx.Quantity).toLocaleString()}</td>
                            <td className="px-5 py-2.5 text-right text-gray-500">£{Number(tx.UnitPrice).toFixed(2)}</td>
                            <td className="px-5 py-2.5 text-right font-semibold text-emerald-700">
                              £{Number(tx.TotalPrice).toFixed(2)}
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
                          <span className="text-gray-500 font-semibold">{Number(p.total_qty).toLocaleString()} units</span>
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
  );
}

