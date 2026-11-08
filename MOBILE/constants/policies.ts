// constants/policies.ts
// Nội dung "Chính sách sử dụng" của web (FE/src/shared/Policies.tsx) cho màn Chính sách sử dụng trên mobile — giữ nguyên lời của web
// để hai nơi không mâu thuẫn. BE là nơi quyết định các quy tắc này.
//
// Chỉ bỏ đoạn dành riêng cho Quản lý (mobile chỉ có Hội viên và Huấn luyện viên).

export interface PolicySection {
  title: string;
  paragraphs: readonly string[];
}

export const POLICIES_TITLE = 'Chính sách sử dụng';
export const POLICIES_INTRO = 'Các điều kiện cần kiểm tra khi thao tác tại trung tâm.';

export const POLICY_SECTIONS: readonly PolicySection[] = [
  {
    title: 'Gói hội viên & đăng ký lớp',
    paragraphs: [
      'Gói chỉ có hiệu lực khi đang hoạt động, đã đến ngày bắt đầu và chưa hết hạn. Gói đã ngừng quyền lợi, đã hủy hoặc hết hạn không cấp quyền đăng ký lớp. Lớp Premium yêu cầu gói Premium còn hiệu lực. Gói phải còn hạn đến thời điểm buổi học bắt đầu, trừ quyền học trọn kỳ đã được duyệt: khi đăng ký trọn khóa, gói còn ít nhất 50% tổng thời hạn đã mua được cấp quyền học lớp đó đến hết kỳ. Ngày hết hạn gói không thay đổi; quyền này không áp dụng cho lớp mới.',
      'Chỉ đăng ký lịch còn mở, chưa bắt đầu và còn chỗ. Mỗi hội viên chỉ có một lượt đăng ký hợp lệ cho một buổi, không đặt các lớp trùng giờ. Có thể đặt lại sau khi hủy nếu vẫn đủ điều kiện.',
      'Gói tập có hiệu lực trên mọi cơ sở. Quota tính số lớp khác nhau đang giữ chỗ tương lai trên toàn hệ thống, không tăng khi đổi cơ sở. Gói FREE có quota 0, vẫn được check-in vào cửa. Khi đặt lớp tại cơ sở khác, hệ thống kiểm tra thêm thời gian di chuyển giữa các buổi (mặc định 30 phút). Buổi đầy có thể đăng ký chờ; khi có chỗ, hệ thống xét lại điều kiện đặt lớp.',
      'Hội viên liên hệ lễ tân khi cần hỗ trợ về lịch đã đăng ký. Giao diện hội viên không cung cấp xin nghỉ, đổi buổi hoặc hủy đặt chỗ. Huấn luyện viên không đăng ký hoặc hủy thay hội viên.',
    ],
  },
  {
    title: 'Lịch học & điểm danh',
    paragraphs: [
      'Phòng và huấn luyện viên không được trùng lịch. Sức chứa phòng phải đủ cho sĩ số lớp. Khi hủy buổi học, các lượt đăng ký đang đặt sẽ bị hủy.',
      'Quản lý hoặc huấn luyện viên phụ trách chỉ hoàn tất buổi học sau giờ kết thúc. Hoàn tất lịch sẽ ghi vắng cho người chưa điểm danh. Điểm danh có bốn kết quả: có mặt, vắng mặt, đi muộn và vắng có phép; do quản lý hoặc huấn luyện viên phụ trách ghi nhận.',
    ],
  },
  {
    title: 'Chuyên cần',
    paragraphs: [
      'Khóa cố định được vắng tối đa 20% tổng số buổi kế hoạch, làm tròn xuống. Dùng hết mức cho phép sẽ nhận nhắc nhở; vượt mức sẽ nhận cảnh báo. Lớp định kỳ tính trên 10 buổi gần nhất, tối thiểu 5 buổi: từ 80% là bình thường, 70–dưới 80% nhắc nhở, dưới 70% cảnh báo.',
      'Cảnh báo không tự động hạn chế đặt lớp hoặc thay đổi gói tập. Quản lý có thể áp dụng quyết định riêng, chặn đặt đúng lớp trong 30 ngày và hủy chỗ tương lai của lớp đó. Hội viên có thể khiếu nại trong 72 giờ; khiếu nại không tự gỡ quyết định.',
    ],
  },
  {
    title: 'Thanh toán & quyền lợi',
    paragraphs: [
      'Mua gói qua VietQR hoặc mua và gia hạn tại quầy. Khi nhân viên xác nhận đăng ký hoặc gia hạn, hệ thống ghi nhận đã thu tiền và phát hành hóa đơn ngay. Không ghi thêm một thanh toán trùng cho cùng khoản đã thu.',
      'Mỗi hội viên có tối đa một gói ACTIVE. Gia hạn cùng hạng nối tiếp sau ngày hết hạn. Nâng hạng có thể bắt đầu ngay hoặc lên lịch; hạ hạng chỉ bắt đầu sau khi gói hiện tại kết thúc. Mỗi hội viên chỉ có một gói chờ kích hoạt. Gói đã ngừng, hết hạn hoặc hủy không thể khôi phục. Gói chờ chưa kích hoạt có thể hủy theo chính sách hoàn 100%.',
      'Chỉ thanh toán thành công mới được ghi nhận hoàn tiền, do lễ tân hoặc quản trị viên xử lý. Hoàn tiền không tự chuyển tiền ngân hàng. Hoàn toàn bộ một giao dịch tại quầy có thể hủy gói ACTIVE liên quan và các lượt đặt từ quyền của gói đó ở mọi cơ sở. Quyền độc lập hợp lệ được giữ lại. Hội viên tự hủy được hoàn 30% khoản gốc khi còn trên 15 ngày, còn từ 15 ngày trở xuống không hoàn; nhân viên hủy được tính theo tỷ lệ ngày còn lại. Tiền hoàn nhận tại quầy.',
      'Giao dịch SePay đã thu nhưng chưa cấp gói và đang cần đối soát có thể được quản trị viên duyệt yêu cầu hoàn toàn bộ. Sau khi duyệt, giao dịch không được kích hoạt lại; lễ tân hoặc quản trị viên xác nhận đã trả tiền kèm biên nhận thực tế.',
    ],
  },
  {
    title: 'Tài khoản & thông tin cá nhân',
    paragraphs: [
      'Không chia sẻ tài khoản hoặc thông tin hội viên trong phòng chat chung. Tin nhắn trong phòng chung hiển thị cho các tài khoản của trung tâm; chọn người nhận để trao đổi riêng.',
      'Khi tài khoản bị khóa hoặc thay đổi vai trò, phiên truy cập cũ không còn được sử dụng. Hãy đăng nhập lại hoặc liên hệ trung tâm.',
    ],
  },
];
