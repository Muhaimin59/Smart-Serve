/* Lightweight SVG charts for the admin dashboard (no heavy dependencies). */

export function BarChart({ data, height = 180, color = "var(--primary)" }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="w-full overflow-x-auto no-scrollbar">
      <svg viewBox={`0 0 ${data.length * 46 + 20} ${height + 30}`} style={{ minWidth: data.length * 46 + 20 }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 20);
          return (
            <g key={i} transform={`translate(${i * 46 + 10}, 0)`}>
              <title>{`${d.label}: ${d.value}`}</title>
              <rect x={6} y={height - h} width={26} height={Math.max(2, h)} rx={5} fill={color} opacity={0.9}>
                <animate attributeName="height" from="0" to={Math.max(2, h)} dur="0.5s" fill="freeze" />
              </rect>
              <text x={19} y={height + 16} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({ data, height = 180 }: { data: { label: string; value: number }[]; height?: number }) {
  const w = 560;
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * (w - 30) + 15;
    const y = height - 24 - (d.value / max) * (height - 50);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L${pts[pts.length - 1]?.[0] ?? 0},${height - 24} L${pts[0]?.[0] ?? 0},${height - 24} Z`;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${height + 10}`} className="w-full">
        <path d={area} fill="var(--primary-soft)" />
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={3.5} fill="var(--primary)" />
            <title>{`${data[i].label}: ${data[i].value}`}</title>
          </g>
        ))}
        <text x={15} y={height + 4} fontSize="10" fill="var(--text-muted)">
          {data[0]?.label}
        </text>
        <text x={w - 15} y={height + 4} fontSize="10" fill="var(--text-muted)" textAnchor="end">
          {data[data.length - 1]?.label}
        </text>
      </svg>
    </div>
  );
}

export function DonutChart({ data, size = 170 }: { data: { label: string; value: number }[]; size?: number }) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  const palette = ["var(--primary)", "var(--secondary)", "var(--info)", "var(--success)", "var(--warning)", "#8b5cf6", "#14b8a6", "#64748b"];
  let acc = 0;
  const r = size / 2 - 14;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={16} />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circ;
          const el = (
            <circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth={16}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-acc * circ}
              transform={`rotate(-90 ${c} ${c})`}
              strokeLinecap="butt"
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
          acc += frac;
          return el;
        })}
        <text x={c} y={c - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text)">
          {total}
        </text>
        <text x={c} y={c + 16} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
          total
        </text>
      </svg>
      <div className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: palette[i % palette.length] }} />
            <span style={{ color: "var(--text-muted)" }}>{d.label}</span>
            <span className="font-bold ml-auto pl-3">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
