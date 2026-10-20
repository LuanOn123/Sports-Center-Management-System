// components/member/membership/PlanSwitchSheet.tsx
// Bảng xác nhận khi đã có gói và mua gói khác (web: modal "Gia hạn / Nâng cấp / Lên lịch gói tiếp theo"):
// - Gia hạn cùng hạng: tự nối tiếp sau ngày hết hạn gói hiện tại
// - Nâng cấp: kích hoạt ngay hoặc chọn ngày (tối đa PLAN_SCHEDULE_MAX_DAYS ngày)
// - Hạ cấp: lên lịch từ ngày gói hiện tại hết hạn
// Quy tắc ngày ở lib/planSwitch.ts (khớp BE).

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { Icon } from '../../shared/Icon';
import { DatePickerSheet } from '../../shared/DatePickerSheet';
import { Colors, Spacing } from '../../../constants/theme';
import { PLAN_SCHEDULE_MAX_DAYS, PLAN_SWITCH_TITLE, TIER_ICON, TIER_LABEL } from '../../../constants/membership';
import { formatDate, formatVnd } from '../../../lib/format';
import { formatIsoDate, toIsoDate } from '../../../lib/profileFields';
import {
  automaticStartDate, checkoutStartDate, detectPlanSwitchType, planStartWindow, shorterSameTierWarning,
} from '../../../lib/planSwitch';
import type { MembershipPlan, Subscription } from '../../../lib/types';

type UpgradeMode = 'now' | 'date';

interface PlanSwitchSheetProps {
  plan: MembershipPlan | null;
  activeSub: Subscription | null;
  isCreating: boolean;
  onConfirm: (startDate: string | undefined) => void;
  onClose: () => void;
}

function InfoBox({ icon, color = Colors.status.scheduled, children }: { icon: string; color?: string; children: React.ReactNode }) {
  return (
    <View className="flex-row gap-sm rounded-md p-md border mb-md" style={{ backgroundColor: color + '12', borderColor: color + '40' }}>
      <Icon name={icon} size={16} color={color} style={{ marginTop: 2 }} />
      <Text className="flex-1 text-sm text-text-secondary font-bevn-regular leading-[20px]">{children}</Text>
    </View>
  );
}

function OptionRow({ selected, title, description, onPress, children }: {
  selected: boolean; title: string; description: string; onPress: () => void; children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={clsx('rounded-lg p-md border mb-sm', selected ? 'border-primary bg-bg-elevated' : 'border-border')}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row items-center gap-sm">
        <Icon name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} size={18} color={selected ? Colors.primary : Colors.text.muted} />
        <Text className="flex-1 text-md text-text-primary font-bevn-semibold">{title}</Text>
      </View>
      <Text className="text-xs text-text-secondary font-bevn-regular mt-xs ml-[26px]">{description}</Text>
      {children}
    </TouchableOpacity>
  );
}

export function PlanSwitchSheet({ plan, activeSub, isCreating, onConfirm, onClose }: PlanSwitchSheetProps) {
  const insets = useSafeAreaInsets();
  const type = plan ? detectPlanSwitchType(activeSub, plan) : 'NEW';
  const startWindow = useMemo(() => planStartWindow(type, activeSub, PLAN_SCHEDULE_MAX_DAYS), [type, activeSub]);
  const autoStart = automaticStartDate(type, activeSub);
  const [mode, setMode] = useState<UpgradeMode>('now');
  const [chosenDate, setChosenDate] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Mỗi lần mở cho một gói: về mặc định (nâng cấp: kích hoạt ngay; hạ cấp: ngày gói hiện tại hết hạn)
  useEffect(() => {
    setMode('now');
    setChosenDate(startWindow ? toIsoDate(startWindow.initial) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  if (!plan) return null;

  const tierColor = Colors.tier[plan.tier];
  const pickDate = type === 'DOWNGRADE' || (type === 'UPGRADE' && mode === 'date');
  const warning = shorterSameTierWarning(activeSub, plan);

  const confirm = () => onConfirm(checkoutStartDate(type, pickDate && startWindow ? chosenDate : undefined, activeSub));

  const dateField = startWindow && (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Chọn ngày kích hoạt"
        className="flex-row items-center justify-between bg-bg-elevated rounded-md p-md border border-border mt-sm"
        onPress={() => setPickerOpen(true)}
      >
        <Text className="text-md text-text-primary font-bevn-medium">{formatIsoDate(chosenDate) || 'Chọn ngày'}</Text>
        <Icon name="calendar-today" size={18} color={Colors.text.secondary} />
      </TouchableOpacity>
      <DatePickerSheet
        visible={pickerOpen}
        title="Ngày kích hoạt gói"
        value={chosenDate}
        defaultValue={startWindow.initial}
        min={startWindow.min}
        max={startWindow.max}
        onConfirm={(date) => {
          setChosenDate(date);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-overlay justify-end" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          className="bg-bg-surface rounded-t-xl border-t border-border px-xl pt-xl"
          style={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}
        >
          <View className="flex-row items-center justify-between mb-lg">
            <Text className="flex-1 text-lg font-bevn-bold text-text-primary mr-sm">{PLAN_SWITCH_TITLE[type]}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Đóng">
              <Icon name="close" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Gói sẽ mua */}
          <View className="bg-bg-elevated rounded-lg p-md border border-border mb-md">
            <View className="flex-row items-center gap-1 mb-xs">
              <Icon name={TIER_ICON[plan.tier]} size={14} color={tierColor} />
              <Text className="text-xs font-bevn-bold" style={{ color: tierColor }}>HẠNG {TIER_LABEL[plan.tier].toUpperCase()}</Text>
            </View>
            <Text className="text-md text-text-primary font-bevn-bold">{plan.name}</Text>
            <Text className="text-sm text-text-secondary font-bevn-regular mt-0.5">{formatVnd(plan.price)} · {plan.durationDays} ngày</Text>
            {activeSub && (
              <Text className="text-xs text-text-muted font-bevn-regular mt-xs">
                Đang dùng: {activeSub.plan?.name ?? `Gói ${TIER_LABEL[activeSub.tier ?? 'FREE']}`} · hết hạn {formatDate(activeSub.endDate)}
              </Text>
            )}
          </View>

          {type === 'RENEW_SAME_TIER' && (
            <InfoBox icon="autorenew">
              {autoStart
                ? <>Gói mới tự động nối tiếp thời hạn gói hiện tại, kích hoạt vào ngày <Text className="font-bevn-bold text-text-primary">{formatDate(autoStart)}</Text>. Bạn không bị mất ngày tập nào.</>
                : 'Gói mới sẽ được kích hoạt ngay sau khi thanh toán thành công.'}
            </InfoBox>
          )}

          {type === 'UPGRADE' && (
            <>
              <OptionRow
                selected={mode === 'now'}
                title="Kích hoạt ngay"
                description={`Hưởng ngay quyền lợi hạng ${TIER_LABEL[plan.tier]} sau khi thanh toán. Gói hiện tại sẽ được thay thế.`}
                onPress={() => setMode('now')}
              />
              <OptionRow
                selected={mode === 'date'}
                title="Chọn ngày kích hoạt"
                description={`Gói hiện tại vẫn dùng tới ngày bạn chọn (tối đa ${PLAN_SCHEDULE_MAX_DAYS} ngày kể từ hôm nay).`}
                onPress={() => setMode('date')}
              >
                {mode === 'date' && dateField}
              </OptionRow>
            </>
          )}

          {type === 'DOWNGRADE' && (
            startWindow ? (
              <>
                <InfoBox icon="event-available">
                  Gói hạ cấp được lưu ở trạng thái <Text className="font-bevn-bold text-text-primary">Đã lên lịch</Text> và chỉ có hiệu lực sau khi gói hiện tại kết thúc ngày {formatDate(activeSub!.endDate)}.
                </InfoBox>
                <Text className="text-sm text-text-secondary font-bevn-medium">Ngày bắt đầu kích hoạt</Text>
                {dateField}
                <View className="mb-md" />
              </>
            ) : (
              <InfoBox icon="info">Gói hiện tại đã hết hạn — gói mới sẽ được kích hoạt ngay sau khi thanh toán.</InfoBox>
            )
          )}

          {Boolean(warning) && <InfoBox icon="warning" color={Colors.status.pending}>{warning}</InfoBox>}

          <TouchableOpacity
            accessibilityRole="button"
            className={clsx('flex-row justify-center items-center gap-1.5 bg-primary rounded-md p-md mt-xs', (isCreating || (pickDate && startWindow && !chosenDate)) && 'opacity-60')}
            onPress={confirm}
            disabled={isCreating || Boolean(pickDate && startWindow && !chosenDate)}
          >
            {isCreating ? <ActivityIndicator color={Colors.text.inverse} size="small" /> : <Icon name="qr-code-scanner" size={17} color={Colors.text.inverse} />}
            <Text className="text-text-inverse font-bevn-bold text-md">{isCreating ? 'Đang tạo mã...' : `Thanh toán ${formatVnd(plan.price)} qua VietQR`}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center py-md" onPress={onClose} disabled={isCreating}>
            <Text className="text-md text-text-secondary font-bevn-semibold">Để sau</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
