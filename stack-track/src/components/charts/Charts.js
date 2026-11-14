import React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { compactMoney, money } from '../../lib/format';

// Chart styling follows the app tokens: hairline solid grid, 2px lines,
// 10% area wash, 24px max bars with rounded data-ends.
const AXIS = { stroke: 'var(--line)', tick: { fill: 'var(--text-3)', fontSize: 12 }, tickLine: false };
const GRID = { stroke: 'var(--line)', strokeDasharray: '0', vertical: false };

function TipBox({ title, rows }) {
  return (
    <div className="chart-tip">
      {title && <div className="chart-tip-title">{title}</div>}
      {rows.map(([label, value, tone]) => (
        <div className="chart-tip-row" key={label}>
          <span>{label}</span>
          <span className={`num ${tone || ''}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

const tone = (n) => (n > 0.5 ? 'gain' : n < -0.5 ? 'loss' : '');

/** Running net result. One point per tournament. */
export function BankrollChart({ points, height = 260 }) {
  if (!points || points.length < 2) return null;
  const last = points[points.length - 1];
  const stroke = 'var(--orange)';
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ed7b3f" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#ed7b3f" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="index" {...AXIS} tickFormatter={(i) => (points[i] ? points[i].label : '')} minTickGap={48} />
          <YAxis {...AXIS} axisLine={false} width={56} tickFormatter={compactMoney} />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <Tooltip
            cursor={{ stroke: 'var(--text-3)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0].payload;
              if (!p.index) return <TipBox title="Start" rows={[['Running total', money(0)]]} />;
              return (
                <TipBox
                  title={p.name}
                  rows={[
                    [p.label, money(p.net, { sign: true }), tone(p.net)],
                    ['Running total', money(p.cum, { sign: true }), tone(p.cum)],
                  ]}
                />
              );
            }}
          />
          <Area
            type="linear"
            dataKey="cum"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#bankrollFill)"
            dot={false}
            activeDot={{ r: 5, fill: stroke, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <span className="sr-only">{`Running total after ${points.length - 1} tournaments: ${money(last.cum, { sign: true })}`}</span>
    </div>
  );
}

/** Bar with a rounded end away from the zero line, square at the baseline. */
function PolarityBar({ x, y, width, height, fill, payload }) {
  if (!width || !height) return null;
  const r = Math.min(4, Math.abs(height), width / 2);
  // Depending on version recharts may pass a negative height for values below
  // zero, so normalise the box and take the direction from the data itself.
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  const roundTop = (payload?.net ?? 0) >= 0;
  const path = roundTop
    ? `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${top + h} Z`
    : `M${x},${top} L${x + width},${top} L${x + width},${top + h - r} Q${x + width},${top + h} ${x + width - r},${top + h} L${x + r},${top + h} Q${x},${top + h} ${x},${top + h - r} Z`;
  return <path d={path} fill={fill} />;
}

/** Net result per week / month / year. Green above zero, red below. */
export function PeriodBars({ data, height = 240 }) {
  if (!data || !data.length) return null;
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} minTickGap={24} />
          <YAxis {...AXIS} axisLine={false} width={56} tickFormatter={compactMoney} />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0].payload;
              return (
                <TipBox
                  title={p.label}
                  rows={[
                    ['Net', money(p.net, { sign: true }), tone(p.net)],
                    ['Tournaments', String(p.count)],
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="net" maxBarSize={24} shape={<PolarityBar />} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.net >= 0 ? '#45d38e' : '#f2606f'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny trend line for cards. */
export function Sparkline({ points, height = 56 }) {
  if (!points || points.length < 2) return null;
  return (
    <div className="sparkline" style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="linear" dataKey="cum" stroke="var(--orange)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
