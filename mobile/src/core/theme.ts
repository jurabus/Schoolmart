export const colors = {
  bg: '#faf8f5',
  surface: '#ffffff',
  text: '#1c1917',
  muted: '#78716c',
  line: '#e7e5e4',
  soft: '#f5f5f4',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  ok: '#15803d',
  okBg: '#dcfce7',
  noticeBg: '#fffbeb',
  noticeText: '#78350f',
  preBg: '#dbeafe',
  preText: '#1e40af',
  offBg: '#f1f5f9',
  offText: '#64748b',
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = 16;

export const statusColors: Record<string, { bg: string; fg: string }> = {
  new: { bg: '#fef3c7', fg: '#92400e' },
  confirmed: { bg: '#dbeafe', fg: '#1e40af' },
  delivered: { bg: '#dcfce7', fg: '#166534' },
  cancelled: { bg: '#f1f5f9', fg: '#475569' },
};
