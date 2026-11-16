// components/account/HelpGuideView.tsx
// Hướng dẫn sử dụng (web: shared/HelpPanel.tsx): lời dẫn, ô tìm, các chủ đề theo vai trò (mỗi chủ đề ba bước + nút "Mở chức năng"),
// mục tin nhắn / tệp đính kèm và lối tới Chính sách sử dụng. Nội dung ở constants/help.ts, logic ở hooks/shared/useHelpGuide.

import React from 'react';
import { View, Text } from 'react-native';
import { WorkflowButton, WorkflowField, WorkflowScreen, WorkflowState, WorkflowText } from '../shared/WorkflowScreen';
import { Button } from '../ui/Button';
import { HelpAccordion } from './HelpAccordion';
import { useHelpGuide } from '../../hooks/shared/useHelpGuide';
import { HELP_TEXT as TEXT, HELP_TIPS } from '../../constants/help';

/** Độ dài tối đa ô tìm (web: không giới hạn; các ô tìm khác của app dùng 100) */
const SEARCH_MAX_LENGTH = 100;

export function HelpGuideView() {
  const help = useHelpGuide();

  return (
    <WorkflowScreen title={TEXT.title}>
      <WorkflowText>{TEXT.intro}</WorkflowText>
      <WorkflowField
        label={TEXT.searchLabel}
        value={help.search}
        onChangeText={help.setSearch}
        placeholder={TEXT.searchPlaceholder}
        maxLength={SEARCH_MAX_LENGTH}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {help.guides.map((guide) => (
        <HelpAccordion key={guide.id} title={guide.title}>
          {guide.steps.map((step, index) => (
            <View key={step} className="flex-row gap-sm">
              <Text className="w-5 text-sm text-primary font-bevn-bold">{index + 1}.</Text>
              <Text className="flex-1 text-sm text-text-secondary font-bevn-regular leading-[20px]">{step}</Text>
            </View>
          ))}
          <Button title={TEXT.openFeature} variant="secondary" size="sm" icon="arrow-forward" block={false} onPress={() => help.open(guide)} />
        </HelpAccordion>
      ))}
      {help.guides.length === 0 && <WorkflowState empty={TEXT.noResult} />}

      <HelpAccordion title={HELP_TIPS.title}>
        {HELP_TIPS.items.map((tip) => (
          <View key={tip} className="flex-row gap-sm">
            <Text className="w-3 text-sm text-primary font-bevn-bold">•</Text>
            <Text className="flex-1 text-sm text-text-secondary font-bevn-regular leading-[20px]">{tip}</Text>
          </View>
        ))}
      </HelpAccordion>

      <WorkflowButton title={TEXT.policies} secondary onPress={help.openPolicies} />
    </WorkflowScreen>
  );
}
