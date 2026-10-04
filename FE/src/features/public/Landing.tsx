import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Menu,
  X,
  CalendarDays,
  Check,
  Dumbbell,
  Bell,
  Plus,
} from "lucide-react";
import { Brand } from "../../shared/Brand";
import "./landing.css";
import { AmbientMotion, usePublicMotion } from "../../shared/PublicMotion";

const movements = [
  {
    name: "Sức mạnh",
    tag: "STRENGTH & CONDITIONING",
    title: "Thêm một lần nữa.\nMạnh hơn một chút.",
    text: "Dành thời gian cho sức mạnh, sức bền và cảm giác vượt qua chính mình. Tìm lớp tập phù hợp với mục tiêu của bạn.",
    image: "photo-1534438327276-14e5300c3a48",
    alt: "Không gian phòng tập với tạ và thiết bị rèn luyện sức mạnh",
    note: "Từng hiệp tập. Từng bước tiến.",
  },
  {
    name: "Yoga",
    tag: "BALANCE & MOBILITY",
    title: "Chậm lại một nhịp.\nKết nối với cơ thể.",
    text: "Một khoảng dành riêng cho hơi thở và chuyển động. Khám phá các lớp yoga để rèn sự dẻo dai và tìm lại cân bằng.",
    image: "photo-1544367567-0f2fcb009e0b",
    alt: "Người tập yoga trong không gian sáng và yên tĩnh",
    note: "Hít sâu. Thả lỏng. Bắt đầu lại.",
  },
  {
    name: "Đồng đội",
    tag: "TEAM SPORTS",
    title: "Có đồng đội.\nCó thêm động lực.",
    text: "Niềm vui của một đường chuyền đẹp, một pha phối hợp ăn ý. Khám phá các bộ môn và tìm lớp để cùng nhau ra sân.",
    image: "photo-1546519638-68e109498ffc",
    alt: "Sân bóng rổ trong nhà với vạch sân và khán đài",
    note: "Cuộc hẹn tiếp theo, ở trên sân.",
  },
];
const photo = (id: string, width = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
const questions = [
  [
    "Tôi chưa từng tập, có thể tham gia không?",
    "Bạn có thể tạo tài khoản, xem thông tin lớp và huấn luyện viên trước khi chọn. Nếu chưa biết bắt đầu từ đâu, hãy trao đổi với lễ tân để được tư vấn lớp phù hợp.",
  ],
  [
    "Tạo tài khoản có mất phí không?",
    "Tạo tài khoản là miễn phí. Chi phí gói thành viên và điều kiện đăng ký lớp được hiển thị trong không gian hội viên để bạn xem trước khi lựa chọn.",
  ],
  [
    "Tôi đăng ký lớp và xem lịch ở đâu?",
    "Sau khi đăng nhập, vào Khám phá lớp học để tìm lớp. Các lớp đã đăng ký và lịch tập được quản lý trong Lớp của tôi và Lịch tập.",
  ],
  [
    "Tôi có thể theo dõi gói tập và thanh toán không?",
    "Có. Trong tài khoản hội viên, bạn có thể xem gói thành viên, trạng thái thanh toán và hóa đơn của mình.",
  ],
];

export function Landing({ signedIn }: { signedIn: boolean }) {
  const motionRoot = usePublicMotion<HTMLDivElement>();
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState(0);
  const movement = movements[active];
  const start = signedIn ? "/login" : "/register";
  useEffect(() => {
    document.title = "Pulse Sports Center · Hẹn bạn ở buổi tập tới";
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <div ref={motionRoot} className="pulse-landing">
      <AmbientMotion />
      <a className="lp-skip" href="#main">
        Đến nội dung chính
      </a>
      <header className="lp-header">
        <div className="lp-container lp-nav">
          <Link to="/" aria-label="Pulse Sports Center — Trang chủ">
            <Brand member />
          </Link>
          <nav
            id="landing-navigation"
            className={menu ? "is-open" : ""}
            aria-label="Điều hướng chính"
          >
            <a href="#sports" onClick={() => setMenu(false)}>
              Tìm bộ môn
            </a>
            <a href="#platform" onClick={() => setMenu(false)}>
              Không gian hội viên
            </a>
            <a href="#questions" onClick={() => setMenu(false)}>
              Hỏi & đáp
            </a>
          </nav>
          <div className="lp-nav-actions">
            <Link className="lp-login" to="/login">
              {signedIn ? "Vào tài khoản" : "Đăng nhập"}
            </Link>
            <Link className="lp-button lp-nav-cta" to={start}>
              Tham gia Pulse <ArrowUpRight size={17} />
            </Link>
            <button
              className="lp-menu"
              aria-label={menu ? "Đóng menu" : "Mở menu"}
              aria-controls="landing-navigation"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <section className="lp-hero lp-container">
          <div className="lp-hero-copy">
            <div className="lp-overline">
              <span className="lp-dot" /> PULSE SPORTS CENTER
            </div>
            <h1>
              Hẹn bạn
              <br />ở buổi tập
              <br />
              <em>tới.</em>
              <span className="lp-title-arrow" aria-hidden="true">
                ↗
              </span>
            </h1>
            <p>
              Bỏ lại một ngày dài. Dành một giờ cho mình.
              <br />
              Một lớp tập hợp gu, vài người bạn mới — và lý do để bạn muốn quay
              lại.
            </p>
            <Link to={start} className="lp-button">
              Bắt đầu hành trình <ArrowUpRight size={20} />
            </Link>
            <span className="lp-hero-small">
              Tạo tài khoản miễn phí. Chọn nhịp tập của bạn.
            </span>
          </div>
          <div className="lp-hero-visual">
            <img
              className="lp-hero-photo"
              src={photo("photo-1517836357463-d25dfeac3438")}
              alt="Vận động viên rèn luyện sức mạnh trong phòng tập"
              fetchPriority="high"
            />
            <div className="lp-photo-label">
              <span className="lp-dot" /> YOUR TIME. YOUR PACE.
            </div>
            <span className="lp-photo-index">PULSE / 01</span>
            <div className="lp-photo-caption">
              <span>ĐẾN VÌ MỤC TIÊU.</span>
              <strong>Ở lại vì cảm giác.</strong>
            </div>
            <a
              className="lp-photo-link"
              href="#sports"
              aria-label="Khám phá các bộ môn"
            >
              <ArrowDown size={25} />
            </a>
          </div>
          <div className="lp-hero-foot">
            <span>KHÔNG CẦN HOÀN HẢO. CHỈ CẦN BẮT ĐẦU.</span>
            <a href="#sports">
              Tìm nhịp của bạn <ArrowDown size={15} />
            </a>
          </div>
        </section>
        <div className="lp-strip" aria-hidden="true">
          <span>MOVE AT YOUR PACE</span>
          <span>↗</span>
          <span>FIND YOUR PEOPLE</span>
          <span>↗</span>
          <span>KEEP SHOWING UP</span>
          <span>↗</span>
        </div>
        <section id="sports" className="lp-section lp-container">
          <div className="lp-section-heading">
            <div>
              <div className="lp-overline">01 / CHỌN CÁCH BẠN CHUYỂN ĐỘNG</div>
              <h2>
                Tập điều bạn thích.
                <br />
                <span>Thích việc mình tập.</span>
              </h2>
            </div>
            <p>
              Không phải ai cũng có cùng một đích đến.
              <br />
              Tìm bộ môn khiến bạn thấy mỗi buổi tập
              <br />
              là một cuộc hẹn đáng mong chờ.
            </p>
          </div>
          <div className="lp-movements">
            <div className="lp-movement-list">
              {movements.map((item, index) => (
                <button
                  key={item.name}
                  className={active === index ? "is-active" : ""}
                  aria-pressed={active === index}
                  aria-label={item.name}
                  aria-controls="movement-detail"
                  onClick={() => setActive(index)}
                >
                  <span>0{index + 1}</span>
                  <strong>{item.name}</strong>
                  <ArrowUpRight size={25} />
                </button>
              ))}
              <p>
                Lớp học và lịch đang mở được cập nhật
                <br />
                trong tài khoản hội viên.
              </p>
            </div>
            <div id="movement-detail" className="lp-movement-detail">
              <img
                key={movement.image}
                src={photo(movement.image, 1000)}
                alt={movement.alt}
                loading="lazy"
              />
              <div className="lp-movement-caption">
                <span>{movement.tag}</span>
                <p>{movement.note}</p>
              </div>
              <div className="lp-movement-text" aria-live="polite">
                <h3>{movement.title}</h3>
                <p>{movement.text}</p>
                <Link to={start}>
                  Khám phá lớp học <ArrowUpRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section id="platform" className="lp-platform-section">
          <div className="lp-container lp-platform">
            <div className="lp-platform-copy">
              <div className="lp-overline">02 / MỌI THỨ ĐÃ SẴN SÀNG</div>
              <h2>
                Việc của bạn
                <br />
                là <em>đến tập.</em>
              </h2>
              <p>
                Lịch tập, lớp học, gói thành viên — mở Pulse là thấy. Bớt thời
                gian sắp xếp, thêm thời gian cho điều bạn thích.
              </p>
              <div className="lp-benefit">
                <CalendarDays size={21} />
                <div>
                  <h3>Lịch tập đi cùng nhịp sống</h3>
                  <p>Xem lịch và các lớp đã đăng ký ở cùng một nơi.</p>
                </div>
              </div>
              <div className="lp-benefit">
                <Dumbbell size={21} />
                <div>
                  <h3>Chọn lớp có cơ sở</h3>
                  <p>Xem bộ môn, lịch học và huấn luyện viên trước khi chọn.</p>
                </div>
              </div>
              <div className="lp-benefit">
                <Check size={21} />
                <div>
                  <h3>Gói tập rõ ràng</h3>
                  <p>Theo dõi gói thành viên, thanh toán và hóa đơn.</p>
                </div>
              </div>
              <Link to={start} className="lp-text-link">
                Mở không gian của bạn <ArrowUpRight size={19} />
              </Link>
            </div>
            <div className="lp-preview-wrap">
              <div className="lp-preview">
                <div className="lp-preview-top">
                  <Brand member />
                  <Bell size={18} />
                </div>
                <div className="lp-preview-body">
                  <div className="lp-preview-greeting">
                    <span>KHÔNG GIAN HỘI VIÊN</span>
                    <span className="lp-preview-avatar">P</span>
                  </div>
                  <h3>
                    Một lịch tập.
                    <br />
                    Nhiều điều mong chờ.
                  </h3>
                  <div className="lp-preview-week">
                    {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(
                      (day, i) => (
                        <div key={day} className={i === 2 ? "selected" : ""}>
                          <span>{day}</span>
                          <strong>{12 + i}</strong>
                          {i === 2 && <i />}
                        </div>
                      ),
                    )}
                  </div>
                  <div className="lp-preview-session">
                    <span className="lp-overline">BUỔI TẬP TIẾP THEO</span>
                    <div>
                      <span className="lp-preview-sport">
                        <Dumbbell size={26} />
                      </span>
                      <div>
                        <h4>Strength & Conditioning</h4>
                        <p>18:00 – 19:00 · Phòng tập</p>
                      </div>
                    </div>
                    <span className="lp-preview-status">
                      <Check size={13} /> Đã đăng ký
                    </span>
                  </div>
                  <div className="lp-preview-bottom">
                    <CalendarDays size={17} />
                    <span>Lịch của bạn. Luôn trong tầm tay.</span>
                    <ArrowRight size={17} />
                  </div>
                </div>
              </div>
              <p className="lp-preview-note">
                Giao diện minh họa · Lịch và lớp thực tế theo tài khoản của bạn
              </p>
            </div>
          </div>
        </section>
        <section className="lp-container lp-section lp-start">
          <div>
            <div className="lp-overline">03 / BẮT ĐẦU THẬT ĐƠN GIẢN</div>
            <h2>
              Buổi tập đầu tiên
              <br />
              bắt đầu từ đây.
            </h2>
            <Link className="lp-text-link" to={start}>
              Cùng Pulse bắt đầu <ArrowUpRight size={20} />
            </Link>
          </div>
          <ol>
            {[
              [
                "Tạo tài khoản",
                "Một vài thông tin cơ bản để có không gian hội viên của riêng bạn.",
              ],
              [
                "Tìm lớp hợp gu",
                "Khám phá lớp học, xem lịch và chọn gói tập phù hợp.",
              ],
              [
                "Hẹn gặp ở buổi tập",
                "Đăng ký lớp, theo dõi lịch cá nhân và sẵn sàng đến tập.",
              ],
            ].map(([title, text], i) => (
              <li key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <ArrowUpRight size={22} />
              </li>
            ))}
          </ol>
        </section>
        <section id="questions" className="lp-container lp-faq">
          <div>
            <div className="lp-overline">TRƯỚC KHI BẠN BẮT ĐẦU</div>
            <h2>
              Có thể bạn
              <br />
              đang thắc mắc.
            </h2>
          </div>
          <div>
            {questions.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus size={19} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="lp-container lp-cta-wrap">
          <div className="lp-cta">
            <div className="lp-overline">
              HÔM NAY LÀ MỘT NGÀY ĐẸP ĐỂ BẮT ĐẦU.
            </div>
            <div className="lp-cta-row">
              <h2>
                Dành một giờ.
                <br />
                <span>Cho chính bạn.</span>
              </h2>
              <div>
                <Link to={start} className="lp-button">
                  {signedIn
                    ? "Vào không gian của tôi"
                    : "Tạo tài khoản miễn phí"}
                  <ArrowUpRight size={22} />
                </Link>
                <p>Hẹn bạn ở buổi tập tới.</p>
              </div>
            </div>
            <span className="lp-cta-decoration" aria-hidden="true">
              ↗
            </span>
          </div>
        </section>
      </main>
      <footer className="lp-container lp-footer">
        <div>
          <Link to="/" aria-label="Pulse — Trang chủ">
            <Brand member />
          </Link>
          <p>Chuyển động theo cách của bạn.</p>
        </div>
        <div className="lp-footer-links">
          <a href="#sports">Tìm bộ môn</a>
          <a href="#questions">Hỏi & đáp</a>
          <Link to="/login">
            Đăng nhập <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Pulse Sports Center</span>
          <span>SEE YOU AT THE NEXT SESSION.</span>
        </div>
      </footer>
    </div>
  );
}
