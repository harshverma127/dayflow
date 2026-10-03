import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

export const CHART_COLORS = ['#78809a', '#6f8a76', '#b2744a', '#8a7fa0', '#a8625c', '#5f7f96', '#a07e52', '#8f7f60', '#9a7f88'];

const axisProps = {
  stroke: 'rgb(var(--content-faint))',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  backgroundColor: 'rgb(var(--surface-raised))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(var(--content))',
} as const;

export function ChartCard({ title, subtitle, children, className, action }: { title: string; subtitle?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn('card flex flex-col p-3.5 sm:p-4', className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-content">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-content-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children === null || children === undefined ? null : <div className="h-56 w-full min-w-0">{children}</div>}
    </div>
  );
}

export function ProgressAreaChart({ data, dataKey = 'value', color = CHART_COLORS[0], unit }: { data: { label: string; value: number }[]; dataKey?: string; color?: string; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} width={38} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}${unit ?? ''}`, dataKey]} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({ data, color = CHART_COLORS[0], unit, horizontal }: { data: { label: string; value: number }[]; color?: string; unit?: string; horizontal?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 5, right: 12, left: horizontal ? 4 : -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey="label" {...axisProps} width={92} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" {...axisProps} minTickGap={8} />
            <YAxis {...axisProps} width={38} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}${unit ?? ''}`, 'Value']} cursor={{ fill: 'rgb(var(--content-faint) / 0.08)' }} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, unit = '' }: { data: { label: string; value: number }[]; unit?: string }) {
  const clean = data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={clean} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="none">
          {clean.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v}${unit}`, n]} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(var(--content-muted))' }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MultiLineChart({ data, series }: { data: Record<string, number | string>[]; series: { key: string; color: string; label: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...axisProps} minTickGap={16} />
        <YAxis {...axisProps} width={38} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(var(--content-muted))' }} iconType="circle" iconSize={8} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RadialProgress({ value, label, color = CHART_COLORS[0] }: { value: number; label: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart innerRadius="62%" outerRadius="100%" data={[{ name: label, value }]} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={8} fill={color} background={{ fill: 'rgb(var(--border))' }} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
