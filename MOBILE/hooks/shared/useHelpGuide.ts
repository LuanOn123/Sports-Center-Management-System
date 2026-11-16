// hooks/shared/useHelpGuide.ts
// Màn Hướng dẫn sử dụng (web: HelpPanel): chủ đề theo vai trò, ô tìm, mở màn của chủ đề. Quy tắc thuần ở lib/help.

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import type { HelpGuide } from '../../constants/help';
import { filterGuides, guidesForRole } from '../../lib/help';
import { HELP_ROUTE } from '../../navigation/helpConfig';
import { ROUTES } from '../../navigation/routes';

export function useHelpGuide() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const guides = useMemo(() => filterGuides(guidesForRole(user?.role), search), [user?.role, search]);

  return {
    search,
    setSearch,
    guides,
    /** "Mở chức năng": tới màn của chủ đề */
    open: (guide: HelpGuide) => router.push(HELP_ROUTE[guide.target]),
    openPolicies: () => router.push(ROUTES.policies),
  };
}
