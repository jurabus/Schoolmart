import { Text, type TextStyle } from 'react-native';

/** Shows text with the part that matches the query in bold (like Amazon's suggestions). */
export function Highlight({ text, query, style, boldStyle, lines = 1 }: {
  text: string; query: string; style?: TextStyle; boldStyle?: TextStyle; lines?: number;
}) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <Text style={style} numberOfLines={lines}>{text}</Text>;
  return (
    <Text style={style} numberOfLines={lines}>
      {text.slice(0, i)}
      <Text style={[{ fontWeight: '800' }, boldStyle]}>{text.slice(i, i + q.length)}</Text>
      {text.slice(i + q.length)}
    </Text>
  );
}
