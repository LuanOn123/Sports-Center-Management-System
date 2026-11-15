// hooks/shared/useAvatarUpload.ts
// Đổi ảnh đại diện: xin quyền thư viện ảnh → chọn ảnh vuông (≤ 5 MB) → tải lên → tải lại user

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { uploadAvatar } from '../../services/profileService';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import { AVATAR_MAX_BYTES, AVATAR_PICKER, AVATAR_TEXT as TEXT } from '../../constants/profile';

export function useAvatarUpload() {
  const { refreshUser } = useAuth();

  const upload = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      Haptic.medium();
      const formData = new FormData();
      // Ưu tiên suy đuôi file từ mimeType (đáng tin trên mọi nền tảng) thay vì parse
      // asset.uri — trên web/Android, uri có thể là "blob:..."/"content://..." không
      // có phần đuôi, parse kiểu split('.').pop() sẽ ra rác.
      const mimeExt = asset.mimeType?.split('/')[1]?.toLowerCase();
      const ext = (mimeExt === 'jpeg' ? 'jpg' : mimeExt) || asset.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const fileName = asset.fileName || `avatar.${ext}`;

      if (Platform.OS === 'web') {
        // Web KHÔNG hỗ trợ FormData.append(field, {uri,name,type}) kiểu RN native —
        // phải là Blob thật, nếu không multer nhận field "avatar" như text
        // "[object Object]" thay vì file ⇒ BE báo "Avatar file is required".
        const blob = await fetch(asset.uri).then((r) => r.blob());
        formData.append('avatar', blob, fileName);
      } else {
        formData.append('avatar', { uri: asset.uri, name: fileName, type: mimeType } as unknown as Blob);
      }
      return uploadAvatar(formData);
    },
    onSuccess: async () => {
      Haptic.success();
      await refreshUser();
    },
    onError: (e) => {
      Haptic.error();
      showAlert(TEXT.errorTitle, e instanceof ApiError ? e.message : TEXT.failed);
    },
  });

  const pick = async () => {
    Haptic.light();
    const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      const request = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (request.status !== ImagePicker.PermissionStatus.GRANTED) {
        showAlert(TEXT.permissionTitle, canAskAgain === false ? TEXT.permissionSettings : TEXT.permissionNeeded);
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: AVATAR_PICKER.aspect,
      quality: AVATAR_PICKER.quality,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > AVATAR_MAX_BYTES) {
      showAlert(TEXT.tooLargeTitle, TEXT.tooLarge);
      return;
    }
    upload.mutate(asset);
  };

  return { pick, isUploading: upload.isPending };
}
