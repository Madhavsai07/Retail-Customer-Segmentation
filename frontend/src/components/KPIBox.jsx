import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

const TREND_ICONS = {
  up: FiTrendingUp,
  down: FiTrendingDown,
  neutral: FiMinus,
};

const TREND_COLORS = {
  up: 'text-emerald-600 bg-emerald-50',
  down: 'text-red-500 bg-red-50',
  neutral: 'text-gray-500 bg-gray-100',
};

export default function KPIBox({
  title,
  value,
  subtitle,
  icon,
  iconBg = 'bg-primary-100',
  iconColor = 'text-primary-600',
  trend = 'neutral',
  trendLabel,
}) {
  const TrendIcon = TREND_ICONS[trend];
  const trendCls = TREND_COLORS[trend];

  return (
    <div className="card flex-1 min-w-[180px] hover:shadow-md transition-shadow duration-200 animate-slide-up">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <span className={`text-xl ${iconColor}`}>{icon}</span>
        </div>
        {trendLabel && (
          <span className={`badge ${trendCls} gap-1`}>
            <TrendIcon size={11} />
            {trendLabel}
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
