// lib/device.ts
// Tác vụ thiết bị dùng khi thanh toán: sao chép vào clipboard, lưu ảnh QR vào thư viện ảnh.
//
// Các module native (expo-clipboard / expo-file-system / expo-media-library) được nạp LƯỜI
// bên trong từng hàm, KHÔNG import ở đầu file: import sẵn sẽ làm sập toàn bộ app khi
//  - chạy web (expo-media-library bản mới không có bản web), hoặc
//  - dev build cũ chưa được build lại sau khi thêm thư viện ("Cannot find native module").

import { Platform, Linking } from 'react-native';

type ClipboardModule = typeof import('expo-clipboard');
type FileSystemModule = typeof import('expo-file-system');
type MediaLibraryModule = typeof import('expo-media-library');

/** Sao chép chữ vào clipboard; trả về false nếu thất bại / thiếu module native */
export async function copyToClipboard(text: string) {
  try {
    const Clipboard: ClipboardModule = require('expo-clipboard');
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

/** saved: đã lưu · opened: (web) đã mở ảnh · denied: từ chối quyền · unavailable: app cần build lại · failed: lỗi khác */
export type SaveImageResult = 'saved' | 'opened' | 'denied' | 'unavailable' | 'failed';

/**
 * Tải ảnh từ URL rồi lưu vào thư viện ảnh của máy (để chọn "Quét QR từ ảnh" trong app ngân hàng).
 * Web không có thư viện ảnh → mở ảnh ở tab mới để người dùng tự lưu.
 */
export async function saveRemoteImageToLibrary(url: string, fileName: string): Promise<SaveImageResult> {
  if (Platform.OS === 'web') {
    try {
      await Linking.openURL(url);
      return 'opened';
    } catch {
      return 'failed';
    }
  }

  let FileSystem: FileSystemModule;
  let MediaLibrary: MediaLibraryModule;
  try {
    FileSystem = require('expo-file-system');
    MediaLibrary = require('expo-media-library');
  } catch {
    return 'unavailable';
  }

  // Chỉ xin quyền ghi (không đọc thư viện ảnh)
  const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) return 'denied';

  try {
    const target = new FileSystem.File(FileSystem.Paths.cache, `${fileName}.png`);
    const file = await FileSystem.File.downloadFileAsync(url, target, { idempotent: true });
    await MediaLibrary.Asset.create(file.uri);
    return 'saved';
  } catch {
    return 'failed';
  }
}
