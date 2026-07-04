import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const CLUSTER_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    const d = payload[0];
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-3 text-sm">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        <p className="text-gray-600">
          <span className="font-medium" style={{ color: d.color }}>{d.value.toLocaleString()}</span>
          {' '}customers ({d.payload.pct}%)
        </p>
      </div>
    );
  }
  return null;
};

export default function ClusterChart({ data = [], personas = [] }) {
  const total = data.reduce((s, d) => s + (d.count || 0), 0);

  const getPersonaName = (clusterId) => {
    const p = personas.find(persona => persona.cluster_id === clusterId);
    return p ? p.persona_name : `Cluster ${clusterId}`;
  };

  const chartData = data.map((d) => ({
    ...d,
    name: getPersonaName(d.Cluster),
    pct: total ? ((d.count / total) * 100).toFixed(1) : '0',
  }));

  return (
    <div className="card h-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800">Cluster Distribution</h3>
        <p className="text-xs text-gray-400 mt-0.5">Number of customers per segment</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={CLUSTER_COLORS[idx % CLUSTER_COLORS.length]} />
            ))}
            <LabelList
              dataKey="pct"
              position="top"
              formatter={(v) => `${v}%`}
              style={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>


      <div className="flex flex-wrap gap-3 mt-3">
        {chartData.map((d, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: CLUSTER_COLORS[idx % CLUSTER_COLORS.length] }}
            />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}
