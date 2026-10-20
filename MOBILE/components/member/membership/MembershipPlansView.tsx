// components/member/membership/MembershipPlansView.tsx
// Màn "Gói thành viên" của hội viên — logic ở hooks/member/useMembershipScreen

import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../shared/ScreenHeader';
import { CurrentMembershipCard } from './CurrentMembershipCard';
import { PendingPaymentCard } from './PendingPaymentCard';
import { MembershipPlanCard } from './MembershipPlanCard';
import { SubscriptionHistory } from './SubscriptionHistory';
import { ScheduledMembershipCard } from './ScheduledMembershipCard';
import { PlanSwitchSheet } from './PlanSwitchSheet';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';
import { useMembershipScreen } from '../../../hooks/member/useMembershipScreen';
import type { PaymentScope } from '../../../hooks/member/usePayment';
import type { MembershipPlan } from '../../../lib/types';
import { ApiError } from '../../../lib/api';
import { showAlert } from '../../../lib/alert';
import { Haptic } from '../../../lib/haptics';
import { Colors } from '../../../constants/theme';
import { ROUTES } from '../../../navigation/routes';
import { WorkflowState } from '../../shared/WorkflowScreen';

interface MembershipPlansViewProps {
  memberId: string | undefined;
  scope: PaymentScope;
}

export function MembershipPlansView({ memberId, scope }: MembershipPlansViewProps) {
  const router = useRouter();
  const screen = useMembershipScreen(memberId, scope);
  const { activeSub, scheduledSub, effectiveTier, daysRemaining, plans, subscriptions, pendingPayment, cancel, switchSheet } = screen;

  const openPayment = (paymentId: string) => router.push(ROUTES.payment(paymentId));

  const checkout = (plan: MembershipPlan, startDate?: string) => {
    Haptic.medium();
    screen.startCheckout(
      plan,
      startDate,
      (created) => {
        switchSheet.close();
        openPayment(created.paymentId);
      },
      (e) => showAlert('Không tạo được đơn thanh toán', e instanceof ApiError ? e.message : 'Vui lòng thử lại sau.'),
    );
  };

  // Chưa có gói trả phí → tạo đơn ngay (như web); đã có gói → bảng xác nhận gia hạn / nâng cấp / hạ cấp
  const handleSelectPlan = (plan: MembershipPlan) => {
    if (screen.switchTypeFor(plan) === 'NEW') checkout(plan);
    else {
      Haptic.light();
      switchSheet.open(plan);
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.home);
  };

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader title="Gói thành viên" subtitle="Các gói tập & quyền lợi hội viên" onBackPress={handleGoBack} />

      <ScrollView
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={screen.onRefresh} tintColor={Colors.primary} />}
      >
        <WorkflowState error={screen.error} retry={() => { void screen.onRefresh(); }} />
        {screen.statusLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <CurrentMembershipCard
            activeSub={activeSub}
            tier={effectiveTier}
            daysRemaining={daysRemaining}
            onCancel={cancel.openModal}
          />
        )}

        {scheduledSub && <ScheduledMembershipCard subscription={scheduledSub} />}

        {pendingPayment && (
          <PendingPaymentCard checkout={pendingPayment} onPress={() => openPayment(pendingPayment.paymentId)} />
        )}

        <View className="mb-xl">
          <Text className="text-lg font-bevn-bold text-text-primary mb-md">Các gói thành viên</Text>
          {screen.plansLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            plans.map((plan) => (
              <MembershipPlanCard
                key={plan.id}
                plan={plan}
                registered={screen.registeredFor(plan.id)}
                switchType={screen.switchTypeFor(plan)}
                hint={screen.hintFor(plan)}
                isCreating={screen.creatingPlanId === plan.id && !switchSheet.plan}
                disabled={screen.isCreatingCheckout}
                onCheckout={() => handleSelectPlan(plan)}
              />
            ))
          )}
        </View>

        <SubscriptionHistory subscriptions={subscriptions} />
      </ScrollView>

      <PlanSwitchSheet
        plan={switchSheet.plan}
        activeSub={activeSub}
        isCreating={screen.isCreatingCheckout}
        onConfirm={(startDate) => switchSheet.plan && checkout(switchSheet.plan, startDate)}
        onClose={switchSheet.close}
      />

      <CancelSubscriptionModal
        visible={cancel.open}
        subscription={activeSub}
        estimate={cancel.estimate}
        reason={cancel.reason}
        onReasonChange={cancel.setReason}
        isPending={cancel.mutation.isPending}
        result={cancel.mutation.data?.data}
        error={cancel.mutation.error}
        onConfirm={cancel.confirm}
        onClose={cancel.close}
      />
    </View>
  );
}
