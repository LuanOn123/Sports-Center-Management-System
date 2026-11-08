// app/auth/login.tsx
// Đăng nhập — UI ở components/auth/LoginForm, logic ở hooks/shared/useLoginForm (+ useGoogleAuth cho nút Google)

import { LoginForm } from '../../components/auth/LoginForm';

export default function LoginScreen() {
  return <LoginForm />;
}
