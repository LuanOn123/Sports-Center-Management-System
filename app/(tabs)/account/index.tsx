// app/(tabs)/account/index.tsx
// Tab Tài khoản (màn đầu của Stack ở account/_layout) — UI ở components/account/AccountHubView, logic ở hooks/shared/useAccountHub

import { AccountHubView } from '../../../components/account/AccountHubView';

export default function AccountScreen() {
  return <AccountHubView />;
}
