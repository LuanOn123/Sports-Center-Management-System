import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, Platform, useWindowDimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { attachmentLocation, fetchAttachment } from '../../lib/api';
import { WorkflowButton, WorkflowState } from './WorkflowScreen';

export function ProtectedAttachment({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0);
  const [uri, setUri] = useState('');
  const [image, setImage] = useState(false);
  const [error, setError] = useState<unknown>();
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { width, height } = useWindowDimensions();
  const location = attachmentLocation(url);
  const name = location?.searchParams.get('name') || 'tep-dinh-kem';
  useEffect(() => {
    const controller = new AbortController(); let localUri = '';
    setUri(''); setError(undefined);
    void fetchAttachment(url, controller.signal).then(async (blob) => {
      const isImage = /^image\/(jpeg|png|webp|gif)$/.test(blob.type);
      if (Platform.OS === 'web') localUri = URL.createObjectURL(blob);
      else {
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
        if (controller.signal.aborted) return;
        if (!FileSystem.cacheDirectory) throw new Error('Không thể lưu tệp trên thiết bị.');
        const id = attachmentLocation(url)?.pathname.split('/').pop()?.replace(/[^a-zA-Z0-9_-]/g, '') || 'attachment';
        const ext = isImage ? (blob.type.split('/')[1] === 'jpeg' ? 'jpg' : blob.type.split('/')[1]) : 'pdf';
        localUri = `${FileSystem.cacheDirectory}chat-${id}.${ext}`;
        await FileSystem.writeAsStringAsync(localUri, data, { encoding: FileSystem.EncodingType.Base64 });
      }
      if (!controller.signal.aborted) { setImage(isImage); setUri(localUri); }
      else if (Platform.OS === 'web' && localUri) URL.revokeObjectURL(localUri);
    }).catch((e) => { if (!controller.signal.aborted) setError(e); });
    return () => { controller.abort(); if (Platform.OS === 'web' && localUri) URL.revokeObjectURL(localUri); };
  }, [url, attempt]);
  async function download() {
    if (Platform.OS === 'web') { const anchor = document.createElement('a'); anchor.href = uri; anchor.download = name; anchor.click(); }
    else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    else throw new Error('Thiết bị chưa hỗ trợ chia sẻ tệp.');
  }
  return <View className="gap-sm mt-sm">
    {error ? <WorkflowState error={error} retry={() => setAttempt((n) => n + 1)} /> : !uri ? <Text className="text-xs text-text-secondary font-bevn-regular">Đang tải tệp…</Text> : <>
      {image && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Xem ảnh đính kèm" onPress={() => { setZoom(1); setOpen(true); }}><Image source={{ uri }} resizeMode="contain" style={{ width: Math.min(width * 0.55, 280), height: 180 }} /></TouchableOpacity>}
      <WorkflowButton title={image ? 'Tải ảnh' : `Tải ${name}`} secondary onPress={() => { void download().catch(setError); }} />
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-bg-primary p-xl justify-center gap-md">
          <Image source={{ uri }} resizeMode="contain" style={{ width: width - 40, height: Math.max(180, height * 0.6), transform: [{ scale: zoom }] }} />
          <WorkflowButton title={zoom > 1 ? 'Thu nhỏ ảnh' : 'Phóng to ảnh'} secondary onPress={() => setZoom((value) => value > 1 ? 1 : 1.5)} />
          <WorkflowButton title="Đóng ảnh" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </>}
  </View>;
}
