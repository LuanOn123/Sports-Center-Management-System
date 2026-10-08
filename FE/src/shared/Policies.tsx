export function Policies({ role }: { role: string }) {
  return (
    <div className="workflow-page">
      <div className="page-heading">
        <div>
          <h1>Chính sách sử dụng</h1>
          <p>Các điều kiện cần kiểm tra khi thao tác tại trung tâm.</p>
        </div>
      </div>
      <section className="panel workflow-card">
        <h2>Gói hội viên & đăng ký lớp</h2>
        <p>
          Gói chỉ có hiệu lực khi đang hoạt động, đã đến ngày bắt đầu và chưa
          hết hạn. Gói đã ngừng quyền lợi, đã hủy hoặc hết hạn không cấp quyền đăng ký
          lớp. Lớp Premium yêu cầu gói Premium còn hiệu lực. Gói phải còn hạn
          đến thời điểm buổi học bắt đầu.
        </p>
        <p>
          Chỉ đăng ký lịch còn mở, chưa bắt đầu và còn chỗ. Mỗi hội viên chỉ có
          một lượt đăng ký hợp lệ cho một buổi, không đặt các lớp trùng giờ. Có
          thể đặt lại sau khi hủy nếu vẫn đủ điều kiện.
        </p>
        <p>
          Gói tập có hiệu lực trên mọi cơ sở. Quota tính số lớp khác nhau đang
          giữ chỗ tương lai trên toàn hệ thống, không tăng khi đổi cơ sở.
          Gói FREE có quota 0, vẫn được check-in vào cửa. Khi đặt lớp tại cơ sở khác,
          hệ thống kiểm tra thêm thời gian di chuyển giữa các buổi (mặc định 30 phút).
          Buổi đầy có thể đăng ký chờ; khi có chỗ, hệ thống xét lại điều kiện đặt lớp.
        </p>
        <p>
          Chỉ được hủy lượt đã đặt trước giờ bắt đầu. Hội viên chỉ được hủy lượt
          của mình; huấn luyện viên không đăng ký hoặc hủy thay hội viên.
        </p>
      </section>
      <section className="panel workflow-card">
        <h2>Lịch học & điểm danh</h2>
        <p>
          Phòng và huấn luyện viên không được trùng lịch. Sức chứa phòng phải đủ
          cho sĩ số lớp. Khi hủy buổi học, các lượt đăng ký đang đặt sẽ bị hủy.
        </p>
        <p>
          Quản lý hoặc lễ tân chỉ hoàn tất buổi học sau giờ kết thúc. Hoàn tất
          lịch sẽ ghi vắng cho người chưa điểm danh. Điểm danh có bốn kết quả: có mặt,
          vắng mặt, đi muộn và vắng có phép; do quản lý hoặc huấn luyện viên phụ
          trách ghi nhận.
        </p>
      </section>
      <section className="panel workflow-card">
        <h2>Chuyên cần</h2>
        <p>Khóa cố định được vắng tối đa 20% tổng số buổi kế hoạch, làm tròn xuống. Dùng hết mức cho phép sẽ nhận nhắc nhở; vượt mức sẽ nhận cảnh báo. Lớp định kỳ tính trên 10 buổi gần nhất, tối thiểu 5 buổi: từ 80% là bình thường, 70–dưới 80% nhắc nhở, dưới 70% cảnh báo.</p>
        <p>Cảnh báo không tự động hạn chế đặt lớp hoặc thay đổi gói tập. Quản lý có thể áp dụng quyết định riêng, chặn đặt đúng lớp trong 30 ngày và hủy chỗ tương lai của lớp đó. Hội viên có thể khiếu nại trong 72 giờ; khiếu nại không tự gỡ quyết định.</p>
      </section>
      <section className="panel workflow-card">
        <h2>Thanh toán & quyền lợi</h2>
        <p>
          Mua gói qua VietQR hoặc mua và gia hạn tại quầy. Khi nhân viên xác nhận đăng ký
          hoặc gia hạn, hệ thống ghi nhận đã thu tiền và phát hành hóa đơn ngay.
          Không ghi thêm một thanh toán trùng cho cùng khoản đã thu.
        </p>
        <p>
          Mỗi hội viên có tối đa một gói ACTIVE. Mua hoặc gia hạn tạo gói mới
          và ngừng quyền lợi gói cũ, không cộng ngày dư, không nối kỳ. Gói đã
          ngừng, hết hạn hoặc hủy không thể khôi phục. Không được hạ hạng hoặc
          chọn gói cùng hạng có thời hạn ngắn hơn thời hạn đã bán.
        </p>
        <p>
          Chỉ thanh toán thành công mới được ghi nhận hoàn tiền, do quản lý xử
          lý. Hoàn tiền không tự chuyển tiền ngân hàng. Hoàn toàn bộ một giao dịch
          tại quầy có thể hủy gói ACTIVE liên quan và các lượt đặt tương lai. Hủy gói ACTIVE sẽ hủy các lượt đặt lớp tương lai ở mọi cơ sở: hội viên tự
          hủy được hoàn 30% khoản gốc khi còn trên 15 ngày, còn từ 15 ngày trở
          xuống không hoàn; quản lý hủy được tính theo tỷ lệ ngày còn lại. Tiền
          hoàn nhận tại quầy.
        </p>
      </section>
      <section className="panel workflow-card">
        <h2>Tài khoản & thông tin cá nhân</h2>
        <p>
          Không chia sẻ tài khoản hoặc thông tin hội viên trong phòng chat
          chung. Tin nhắn trong phòng chung hiển thị cho các tài khoản của trung
          tâm; chọn người nhận để trao đổi riêng.
        </p>
        <p>
          Khi tài khoản bị khóa hoặc thay đổi vai trò, phiên truy cập cũ không
          còn được sử dụng. Hãy đăng nhập lại hoặc liên hệ trung tâm.
        </p>
        {role === "MANAGER" && (
          <p>
            Không tự khóa hoặc đổi vai trò của chính mình. Luôn giữ ít nhất một
            quản lý đang hoạt động. Trước khi đổi vai trò hội viên, xử lý gói
            đang hoạt động và lớp đã đặt; trước khi đổi vai trò huấn luyện viên,
            xử lý lịch đang phụ trách.
          </p>
        )}
      </section>
    </div>
  );
}
