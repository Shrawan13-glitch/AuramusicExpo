import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { Appbar, Text, useTheme, Surface, ActivityIndicator, Chip } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppMessage, fetchMessageBody, getCachedMessageBody } from '../utils/messagesService';

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'divider' }
  | { type: 'code'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

const parseTableCells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const parseMarkdown = (input: string): MarkdownBlock[] => {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'divider' });
      index += 1;
      continue;
    }

    const nextTrimmed = lines[index + 1]?.trim() ?? '';
    if (
      trimmed.includes('|') &&
      /^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(nextTrimmed)
    ) {
      const headers = parseTableCells(trimmed);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().includes('|')) {
        const row = parseTableCells(lines[index]);
        if (row.length) {
          rows.push(row);
        }
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: quote.join('\n') });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith('>') &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith('```')
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
};

const InlineText = React.memo(function InlineText({
  text,
  baseColor,
  style,
}: {
  text: string;
  baseColor: string;
  style?: any;
}) {
  const theme = useTheme();
  const linkColor = theme.colors.primary;
  const codeBg = `${theme.colors.surfaceVariant}cc`;
  const regex = /(\[([^\]]*)\]\(([^)]*)\))|(\(([^)]*)\)\[([^\]]*)\])|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|((?:https?:\/\/|www\.)[^\s)]+)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  const normalizeUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
    if (trimmed.startsWith('www.')) return `https://${trimmed}`;
    return `https://${trimmed}`;
  }, []);

  const onOpenLink = useCallback(async (url: string) => {
    try {
      const normalized = normalizeUrl(url);
      const canOpen = await Linking.canOpenURL(normalized);
      if (!canOpen) {
        Alert.alert('Invalid link', 'This link cannot be opened.');
        return;
      }
      await Linking.openURL(normalized);
    } catch {
      Alert.alert('Open failed', 'Unable to open this link right now.');
    }
  }, [normalizeUrl]);

  const parseInlineLink = useCallback((segment: string): { label: string; url: string } | null => {
    const trimmed = segment.trim();
    if (!trimmed) return null;

    const standard = trimmed.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (standard) {
      const label = (standard[1] ?? '').trim() || (standard[2] ?? '').trim();
      const url = (standard[2] ?? '').trim();
      if (!url) return null;
      return { label: label || url, url };
    }

    const alt = trimmed.match(/^\(([^)]*)\)\[([^\]]*)\]$/);
    if (alt) {
      const label = (alt[1] ?? '').trim() || (alt[2] ?? '').trim();
      const url = (alt[2] ?? '').trim();
      if (!url) return null;
      return { label: label || url, url };
    }

    if (/^(?:https?:\/\/|www\.)\S+$/.test(trimmed)) {
      return { label: trimmed, url: trimmed };
    }

    return null;
  }, []);

  while ((match = regex.exec(text)) !== null) {
    const markdownText = match[2];
    const markdownUrl = match[3];
    const altText = match[5];
    const altUrl = match[6];
    const inlineCode = match[8];
    const boldText = match[10];
    const italicText = match[12];
    const rawUrl = match[13];

    if (match.index > last) {
      parts.push(
        <Text key={`text-${last}`} style={[style, { color: baseColor }]}>
          {text.slice(last, match.index)}
        </Text>
      );
    }

    if (match[1]) {
      const url = (markdownUrl ?? '').trim();
      const label = (markdownText ?? '').trim() || url || '[link]';
      if (url) {
        parts.push(
          <Text
            key={`link-${match.index}`}
            style={[style, { color: linkColor, textDecorationLine: 'underline' }]}
            onPress={() => onOpenLink(url)}
          >
            {label}
          </Text>
        );
      } else {
        parts.push(
          <Text key={`link-empty-${match.index}`} style={[style, { color: baseColor }]}>
            {label}
          </Text>
        );
      }
    } else if (match[4]) {
      const url = (altUrl ?? '').trim();
      const label = (altText ?? '').trim() || url || '[link]';
      if (url) {
        parts.push(
          <Text
            key={`link-alt-${match.index}`}
            style={[style, { color: linkColor, textDecorationLine: 'underline' }]}
            onPress={() => onOpenLink(url)}
          >
            {label}
          </Text>
        );
      } else {
        parts.push(
          <Text key={`link-alt-empty-${match.index}`} style={[style, { color: baseColor }]}>
            {label}
          </Text>
        );
      }
    } else if (match[7] && inlineCode) {
      parts.push(
        <Text
          key={`code-${match.index}`}
          style={[
            style,
            {
              color: baseColor,
              backgroundColor: codeBg,
              fontFamily: 'monospace',
              paddingHorizontal: 5,
              borderRadius: 5,
            },
          ]}
        >
          {inlineCode}
        </Text>
      );
    } else if (match[9] && boldText) {
      const boldLink = parseInlineLink(boldText);
      if (boldLink) {
        parts.push(
          <Text
            key={`bold-link-${match.index}`}
            style={[style, { color: linkColor, textDecorationLine: 'underline', fontWeight: '800' }]}
            onPress={() => onOpenLink(boldLink.url)}
          >
            {boldLink.label}
          </Text>
        );
      } else {
        parts.push(
          <Text key={`bold-${match.index}`} style={[style, { color: baseColor, fontWeight: '800' }]}>
            {boldText}
          </Text>
        );
      }
    } else if (match[11] && italicText) {
      const italicLink = parseInlineLink(italicText);
      if (italicLink) {
        parts.push(
          <Text
            key={`italic-link-${match.index}`}
            style={[style, { color: linkColor, textDecorationLine: 'underline', fontStyle: 'italic' }]}
            onPress={() => onOpenLink(italicLink.url)}
          >
            {italicLink.label}
          </Text>
        );
      } else {
        parts.push(
          <Text key={`italic-${match.index}`} style={[style, { color: baseColor, fontStyle: 'italic' }]}>
            {italicText}
          </Text>
        );
      }
    } else if (rawUrl) {
      parts.push(
        <Text
          key={`rawlink-${match.index}`}
          style={[style, { color: linkColor, textDecorationLine: 'underline' }]}
          onPress={() => onOpenLink(rawUrl)}
        >
          {rawUrl}
        </Text>
      );
    }
    last = regex.lastIndex;
  }

  if (last < text.length) {
    parts.push(
      <Text key={`tail-${last}`} style={[style, { color: baseColor }]}>
        {text.slice(last)}
      </Text>
    );
  }

  return <Text style={style}>{parts}</Text>;
});

export default function MessageDetailScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params?: { message?: AppMessage } };
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const message = route.params?.message;
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title = message?.title ?? 'Message';
  const type = message?.type ?? 'announcement';
  const date = message?.date ?? '';
  const url = message?.url ?? '';

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      if (!url) {
        setError('Message link not found.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const cached = await getCachedMessageBody(url);
      if (!mounted) return;
      if (cached) {
        setBody(cached);
        setError(null);
        setLoading(false);
        try {
          const remote = await fetchMessageBody(url);
          if (mounted) {
            setBody(remote);
          }
        } catch (err) {
          console.warn('Failed to refresh message body', err);
        }
        return;
      }

      try {
        const remote = await fetchMessageBody(url);
        if (!mounted) return;
        setBody(remote);
        setError(null);
      } catch (err) {
        console.error('Failed to load message body', err);
        if (mounted) {
          setError('Unable to load this message right now.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [url]);

  const parsed = useMemo(() => parseMarkdown(body), [body]);
  const typeLabel = type === 'alert' ? 'Alert' : type === 'update' ? 'Update' : 'Announcement';

  const openOriginal = useCallback(async () => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // no-op
    }
  }, [url]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.colors.surface }}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Message" />
        <Appbar.Action icon="open-in-new" onPress={openOriginal} />
      </Appbar.Header>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Loading message...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error} />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 12 }}>
            {error}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}>
          <Surface
            style={[
              styles.hero,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
            ]}
            elevation={1}
          >
            <Chip compact icon={type === 'alert' ? 'alert' : type === 'update' ? 'rocket-launch-outline' : 'bullhorn-outline'}>
              {typeLabel}
            </Chip>
            <Text variant="headlineSmall" style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {date}
            </Text>
          </Surface>

          <View style={styles.markdownBody}>
            {parsed.map((block, index) => {
              if (block.type === 'divider') {
                return <View key={`divider-${index}`} style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />;
              }

              if (block.type === 'heading') {
                const size = block.level <= 2 ? 26 : block.level === 3 ? 22 : 18;
                return (
                  <InlineText
                    key={`h-${index}`}
                    text={block.text}
                    baseColor={theme.colors.onSurface}
                    style={{ color: theme.colors.onSurface, fontSize: size, fontWeight: '800', marginTop: 10, marginBottom: 8 }}
                  />
                );
              }

              if (block.type === 'paragraph') {
                return (
                  <InlineText
                    key={`p-${index}`}
                    text={block.text}
                    baseColor={theme.colors.onSurface}
                    style={{ color: theme.colors.onSurface, fontSize: 16, lineHeight: 25, marginBottom: 12 }}
                  />
                );
              }

              if (block.type === 'quote') {
                return (
                  <Surface
                    key={`q-${index}`}
                    style={[
                      styles.quote,
                      { backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.primary },
                    ]}
                    elevation={0}
                  >
                    <InlineText
                      text={block.text}
                      baseColor={theme.colors.onSurfaceVariant}
                      style={{ color: theme.colors.onSurfaceVariant, fontSize: 15, lineHeight: 23 }}
                    />
                  </Surface>
                );
              }

              if (block.type === 'code') {
                return (
                  <Surface
                    key={`code-${index}`}
                    style={[styles.code, { backgroundColor: theme.colors.surfaceVariant }]}
                    elevation={0}
                  >
                    <Text style={{ fontFamily: 'monospace', color: theme.colors.onSurface, lineHeight: 21 }}>
                      {block.text}
                    </Text>
                  </Surface>
                );
              }

              if (block.type === 'table') {
                const columnCount = Math.max(
                  block.headers.length,
                  ...block.rows.map((row) => row.length),
                  1
                );
                const columnWidth = 180;
                const tableWidth = columnCount * columnWidth;
                const getCell = (row: string[], colIndex: number) => row[colIndex] ?? '';

                return (
                  <ScrollView
                    key={`table-${index}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tableWrap}
                    contentContainerStyle={{ paddingRight: 12 }}
                  >
                    <View style={[styles.table, { borderColor: theme.colors.outlineVariant, width: tableWidth }]}>
                      <View style={[styles.tableRow, styles.tableHeaderRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                        {Array.from({ length: columnCount }).map((_, colIndex) => (
                          <View
                            key={`th-${colIndex}`}
                            style={[
                              styles.tableCell,
                              styles.tableHeaderCell,
                              { borderColor: theme.colors.outlineVariant, width: columnWidth },
                            ]}
                          >
                            <InlineText
                              text={getCell(block.headers, colIndex)}
                              baseColor={theme.colors.onSurface}
                              style={{ color: theme.colors.onSurface, fontWeight: '800', fontSize: 14 }}
                            />
                          </View>
                        ))}
                      </View>
                      {block.rows.map((row, rowIndex) => (
                        <View
                          key={`tr-${rowIndex}`}
                          style={[
                            styles.tableRow,
                            { backgroundColor: rowIndex % 2 ? theme.colors.surface : `${theme.colors.surfaceVariant}44` },
                          ]}
                        >
                          {Array.from({ length: columnCount }).map((_, colIndex) => (
                            <View
                              key={`td-${rowIndex}-${colIndex}`}
                              style={[styles.tableCell, { borderColor: theme.colors.outlineVariant, width: columnWidth }]}
                            >
                              <InlineText
                                text={getCell(row, colIndex)}
                                baseColor={theme.colors.onSurface}
                                style={{ color: theme.colors.onSurface, fontSize: 14, lineHeight: 20 }}
                              />
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                );
              }

              return (
                <View key={`list-${index}`} style={{ marginBottom: 12 }}>
                  {block.items.map((item, i) => (
                    <View key={`li-${i}`} style={styles.listItem}>
                      <Text style={{ color: theme.colors.primary, marginTop: 2 }}>{'\u2022'}</Text>
                      <InlineText
                        text={item}
                        baseColor={theme.colors.onSurface}
                        style={{ color: theme.colors.onSurface, fontSize: 16, lineHeight: 24, flex: 1 }}
                      />
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  heroTitle: {
    fontWeight: '800',
    lineHeight: 33,
  },
  markdownBody: {
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  quote: {
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  code: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  tableWrap: {
    marginBottom: 14,
  },
  table: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 520,
  },
  tableHeaderRow: {
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    flexShrink: 0,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: 1,
  },
  tableHeaderCell: {
    justifyContent: 'center',
  },
});
