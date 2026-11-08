// app.config.js
// Cấu hình Expo động: giữ nguyên app.json, chỉ thêm config plugin Google Sign-In khi có iOS client ID.
//
// Plugin dạng không tùy chọn đòi tệp Firebase (google-services.json / GoogleService-Info.plist) và làm hỏng prebuild/EAS Build,
// nên ở đây dùng bản KHÔNG Firebase: chỉ cần iOS URL scheme = iOS client ID đảo ngược
//   "1234-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.1234-abc"
// Android không cần cấu hình ở plugin (OAuth client Android khớp theo package + SHA-1 trên Google Cloud).
// Không có biến này thì bản iOS vẫn build nhưng đăng nhập Google trên iOS sẽ không quay lại được app.

const GOOGLE_PLUGIN = '@react-native-google-signin/google-signin';
const IOS_CLIENT_SUFFIX = '.apps.googleusercontent.com';

/** iOS client ID → URL scheme; chuỗi rỗng nếu thiếu hoặc không đúng dạng */
function iosUrlSchemeOf(iosClientId) {
  const id = (iosClientId || '').trim();
  return id.endsWith(IOS_CLIENT_SUFFIX) ? `com.googleusercontent.apps.${id.slice(0, -IOS_CLIENT_SUFFIX.length)}` : '';
}

module.exports = ({ config }) => {
  const iosUrlScheme = iosUrlSchemeOf(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ...(iosUrlScheme ? [[GOOGLE_PLUGIN, { iosUrlScheme }]] : [])],
  };
};

module.exports.iosUrlSchemeOf = iosUrlSchemeOf;
