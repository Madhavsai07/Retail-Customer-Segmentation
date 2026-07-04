import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CLUSTER_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const PERSONA_NAMES = ['Champions', 'Loyal Customers', 'Occasional', 'At Risk', 'Bargain Hunters'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-3 text-sm">
        <p className="font-semibold text-gray-800 mb-2">Customer #{d.CustomerID}</p>
        <p className="text-gray-500">Recency: <span className="font-medium text-gray-800">{d.Recency} days</span></p>
        <p className="text-gray-500">Frequency: <span className="font-medium text-gray-800">{d.Frequency} orders</span></p>
        <p className="text-gray-500">Monetary: <span className="font-medium text-gray-800">£{d.Monetary?.toLocaleString()}</span></p>
        <p className="text-gray-500 mt-1">Cluster: <span className="font-semibold" style={{ color: CLUSTER_COLORS[d.Cluster] }}>{PERSONA_NAMES[d.Cluster] || `Cluster ${d.Cluster}`}</span></p>
      </div>
    );
  }
  return null;
};

export default function ScatterPlot({ data = [], k = 4 }) {
  const clusters = Array.from({ length: k }, (_, i) =>
    data.filter((d) => d.Cluster === i)
  );

  return (
    <div className="card h-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800">RFM Scatter Plot</h3>
        <p className="text-xs text-gray-400 mt-0.5">Recency vs Monetary — coloured by cluster</p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            type="number"
            dataKey="Recency"
            name="Recency"
            unit=" d"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Recency (days)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis
            type="number"
            dataKey="Monetary"
            name="Monetary"
            unit="£"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <ZAxis range={[30, 80]} />
          <Tooltip content={<CustomTooltip />} />
          {clusters.map((cData, idx) =>
            cData.length > 0 && (
              <Scatter
                key={idx}
                name={PERSONA_NAMES[idx] || `Cluster ${idx}`}
                data={cData}
                fill={CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}
                fillOpacity={0.75}
              />
            )
          )}
        </ScatterChart>
      </ResponsiveContainer>


      <div className="flex flex-wrap gap-3 mt-2">
        {Array.from({ length: k }, (_, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
            />
            {PERSONA_NAMES[i] || `Cluster ${i}`}
          </div>
        ))}
      </div>
    </div>
  );
}
