import { useState } from 'react';
import { MESES_ABBR } from '@ffl/shared';
import { theme } from '../../theme';

interface MonthlyBarChartProps {
  data: number[];
}

const WIDTH = 560;
const HEIGHT = 160;
const PADDING_LEFT = 26;
const PADDING_BOTTOM = 20;
const PADDING_TOP = 10;
const BAR_MAX_WIDTH = 24;
const BAR_RADIUS = 4;

/** Rounded top corners only, square baseline — per dataviz skill's bar/column spec. */
function roundedTopRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  return [
    `M${x},${y + height}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${y + height}`,
    'Z',
  ].join(' ');
}

export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PADDING_LEFT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const maxValue = Math.max(4, ...data);
  const slotWidth = plotWidth / 12;
  const barWidth = Math.min(BAR_MAX_WIDTH, slotWidth - 4);
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue];

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Postais enviados por mês">
        {yTicks.map((tick) => {
          const y = PADDING_TOP + plotHeight - (tick / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line x1={PADDING_LEFT} x2={WIDTH} y1={y} y2={y} stroke={theme.color.borderMute} strokeWidth={1} />
              <text x={PADDING_LEFT - 6} y={y + 3} textAnchor="end" fontSize={9} fill={theme.color.textFaint}>
                {tick}
              </text>
            </g>
          );
        })}
        {data.map((value, i) => {
          const x = PADDING_LEFT + i * slotWidth + (slotWidth - barWidth) / 2;
          const barHeight = (value / maxValue) * plotHeight;
          const y = PADDING_TOP + plotHeight - barHeight;
          const isHover = hoverIndex === i;
          return (
            <g key={i}>
              {/* goldActive/goldBrand (not the lighter `gold`) — validated >=3:1 contrast vs surface, see dataviz skill */}
              <path
                d={roundedTopRectPath(x, y, barWidth, barHeight, BAR_RADIUS)}
                fill={isHover ? theme.color.goldBrand : theme.color.goldActive}
              />
              {/* transparent full-slot hit area — bigger than the painted bar, per interaction spec */}
              <rect
                x={PADDING_LEFT + i * slotWidth}
                y={PADDING_TOP}
                width={slotWidth}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
                tabIndex={0}
              />
              <text x={x + barWidth / 2} y={HEIGHT - 4} textAnchor="middle" fontSize={9.5} fill={theme.color.textFaint}>
                {MESES_ABBR[i]}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverIndex !== null && (
        <div
          style={{
            position: 'absolute',
            left: `${((PADDING_LEFT + hoverIndex * slotWidth + slotWidth / 2) / WIDTH) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -100%)',
            background: theme.color.text,
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {MESES_ABBR[hoverIndex]}: {data[hoverIndex]}
        </div>
      )}
    </div>
  );
}
