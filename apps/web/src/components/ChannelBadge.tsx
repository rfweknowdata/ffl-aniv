import { channelLabel, type Channel } from '@ffl/shared';
import { theme } from '../theme';

export function ChannelBadge({ channel }: { channel: Channel }) {
  const c = theme.channelBadge[channel];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11.5,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {channelLabel(channel)}
    </span>
  );
}
