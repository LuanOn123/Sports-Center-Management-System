// components/assistant/AssistantMarkdown.tsx
// Vẽ câu trả lời Markdown của trợ lý bằng <Text>/<View> (tách khối ở lib/assistantMarkdown.ts).
// Giống web: bỏ HTML, ảnh chỉ còn chữ alt, liên kết chỉ còn chữ hiển thị.

import React, { useMemo } from 'react';
import { Platform, ScrollView, Text, View, type TextStyle } from 'react-native';
import { Colors } from '../../constants/theme';
import { parseMarkdown, type InlineSpan, type MarkdownBlock } from '../../lib/assistantMarkdown';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const WIDE_TABLE_COLUMNS = 3;
const WIDE_CELL_MIN_WIDTH = 112;

const HEADING_CLASS: Record<1 | 2 | 3, string> = {
  1: 'text-lg font-bevn-bold text-text-primary',
  2: 'text-md font-bevn-bold text-text-primary',
  3: 'text-md font-bevn-semibold text-primary',
};

function spanStyle(span: InlineSpan): TextStyle | undefined {
  if (!span.bold && !span.italic && !span.code) return undefined;
  return {
    ...(span.bold ? { fontFamily: 'BeVietnamPro_700Bold' } : null),
    ...(span.italic ? { fontStyle: 'italic' as const } : null),
    ...(span.code ? { fontFamily: MONO, backgroundColor: Colors.bg.primary } : null),
  };
}

function Spans({ spans }: { spans: readonly InlineSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (
        <Text key={index} style={spanStyle(span)}>{span.text}</Text>
      ))}
    </>
  );
}

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <Text selectable className="text-md leading-[22px] font-bevn-regular text-text-primary">
          <Spans spans={block.spans} />
        </Text>
      );

    case 'heading':
      return (
        <Text selectable className={`${HEADING_CLASS[block.level]} leading-[22px] mt-xs`}>
          <Spans spans={block.spans} />
        </Text>
      );

    case 'list':
      return (
        <View className="gap-xs">
          {block.items.map((item, index) => (
            <View key={index} className="flex-row" style={{ paddingLeft: item.depth * 16 }}>
              <Text className="text-md leading-[22px] font-bevn-medium text-text-secondary" style={{ minWidth: 20 }}>{item.marker}</Text>
              <Text selectable className="flex-1 text-md leading-[22px] font-bevn-regular text-text-primary">
                <Spans spans={item.spans} />
              </Text>
            </View>
          ))}
        </View>
      );

    case 'quote':
      return (
        <View className="border-l-2 border-primary pl-md">
          <Text selectable className="text-md leading-[22px] font-bevn-regular text-text-secondary">
            <Spans spans={block.spans} />
          </Text>
        </View>
      );

    case 'code':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="rounded-md border border-border bg-bg-primary" style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 10 }}>
          <Text selectable className="text-sm text-text-primary" style={{ fontFamily: MONO }}>{block.text}</Text>
        </ScrollView>
      );

    case 'table': {
      const wide = block.header.length > WIDE_TABLE_COLUMNS;
      const cellStyle = wide ? { minWidth: WIDE_CELL_MIN_WIDTH } : { flex: 1 };
      const table = (
        <View className="rounded-md border border-border overflow-hidden">
          <View className="flex-row bg-bg-primary">
            {block.header.map((cell, c) => (
              <View key={c} className="p-sm" style={cellStyle}>
                <Text selectable className="text-sm font-bevn-bold text-text-primary"><Spans spans={cell} /></Text>
              </View>
            ))}
          </View>
          {block.rows.map((row, r) => (
            <View key={r} className="flex-row border-t border-border">
              {row.map((cell, c) => (
                <View key={c} className="p-sm" style={cellStyle}>
                  <Text selectable className="text-sm font-bevn-regular text-text-primary"><Spans spans={cell} /></Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
      return wide ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>{table}</ScrollView> : table;
    }

    case 'rule':
      return <View className="h-px bg-border my-xs" />;
  }
}

export function AssistantMarkdown({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  return (
    <View className="gap-sm">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </View>
  );
}
