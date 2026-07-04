import { FiCheckCircle, FiUsers, FiClock, FiShoppingCart, FiDollarSign } from 'react-icons/fi';

export default function PersonaCard({ persona, onClick }) {
  const {
    persona_name, color, description,
    cluster_size, avg_recency, avg_frequency, avg_monetary,
    recommendations = [],
    cluster_id,
  } = persona;

  return (
    <div
      onClick={() => onClick && onClick(cluster_id)}
      className={`card transition-all duration-200 animate-slide-up ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:ring-2' : 'hover:shadow-md hover:-translate-y-0.5'}`}
      style={{ borderTop: `4px solid ${color}`, ...(onClick && { '--tw-ring-color': color }) }}
    >

      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">
            Cluster {cluster_id}
          </span>
          <h3 className="text-xl font-bold text-gray-900 mt-1">{persona_name}</h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
          style={{ backgroundColor: color }}
        >
          {persona_name.charAt(0)}
        </div>
      </div>


      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {[
          { icon: <FiClock size={13} />, label: 'Recency', value: `${avg_recency}d` },
          { icon: <FiShoppingCart size={13} />, label: 'Frequency', value: avg_frequency },
          { icon: <FiDollarSign size={13} />, label: 'Monetary', value: `£${Number(avg_monetary).toLocaleString()}` },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              {stat.icon}
              <span className="text-[10px] uppercase tracking-wider font-semibold">{stat.label}</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-gray-800">{stat.value}</p>
          </div>
        ))}
      </div>


      <div className="flex items-center gap-2 mb-4">
        <FiUsers size={14} className="text-gray-400" />
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{cluster_size?.toLocaleString()}</span> customers
        </span>
      </div>


      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</p>
        <ul className="space-y-2">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
              <FiCheckCircle size={14} className="shrink-0 mt-0.5" style={{ color }} />
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
