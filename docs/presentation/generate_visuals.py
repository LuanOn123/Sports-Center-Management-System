from pathlib import Path
from html import escape
import json

OUT = Path(__file__).resolve().parent
BG, INK, MUTED, BLUE, TEAL, LINE = '#F7F9FC', '#14263D', '#536780', '#2856C7', '#087D83', '#A8B8CB'

def text(x, y, value, size=25, fill=INK, weight=400, anchor='start'):
    return f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>'

def rect(x, y, w, h, fill='white', stroke='none', rx=16):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}"/>'

def lines(x,y,items,size=25,gap=39,fill=INK):
    return ''.join(text(x,y+i*gap,s,size,fill) for i,s in enumerate(items))

def arrow(d, dashed=False):
    return f'<path d="{d}" fill="none" stroke="{MUTED}" stroke-width="2.5" marker-end="url(#arrow)"'+(' stroke-dasharray="7 6"' if dashed else '')+'/>'

def save(name,title,subtitle,content,footer):
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="{escape(title)}">
<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="{MUTED}"/></marker></defs>
<rect width="1600" height="900" fill="{BG}"/>
<g font-family="Segoe UI,Arial,sans-serif">{text(55,57,'PULSE / SPORTS CENTER MANAGEMENT SYSTEM',18,BLUE,600)}
{text(55,116,title,43,INK,650)}{text(55,158,subtitle,23,MUTED)}
{content}{text(55,855,footer,20,MUTED)}{text(1545,855,'SCMS',18,BLUE,600,'end')}</g></svg>'''
    (OUT / f'{name}.svg').write_text(svg,encoding='utf-8')

content=''
panels=[(55,'WEB FRONTEND','React 19 · TypeScript',[
    'Vite 6 — build & dev server','React Router 7 — điều hướng','TanStack Query 5 — dữ liệu API','Fetch API — HTTP client','CSS thuần · Lucide React','Socket.IO Client — chat realtime']),
    (560,'BACKEND','Node.js · Express 5 · TypeScript',[
    'REST API — /api/v1','JWT · bcryptjs — xác thực','Zod — kiểm tra dữ liệu','Prisma 5 — PostgreSQL','Mongoose 9 — MongoDB','Socket.IO 4 — chat realtime']),
    (1065,'MOBILE CLIENT','React Native · Expo',[
    'React Native 0.86 · Expo 57','React 19 · TypeScript','Expo Router — điều hướng','TanStack Query · Axios','NativeWind — giao diện','SecureStore · Camera · QR'])]
for x,h,sub,items in panels:
    content+=rect(x,195,480,388)+rect(x,195,480,8,BLUE,rx=0)+text(x+26,242,h,22,BLUE,600)+text(x+26,282,sub,25,INK,600)+lines(x+26,329,items,23,40)
content+=rect(55,610,1490,91,'#E8EEF9')+text(80,648,'DATA',20,BLUE,600)+text(220,648,'MongoDB: định danh, hồ sơ, refresh token',25)+text(220,683,'PostgreSQL: dữ liệu nghiệp vụ + bản chiếu định danh',25)
content+=text(55,751,'TÍCH HỢP',21,TEAL,600)+text(245,751,'SePay / VietQR · Groq AI · Cloudinary / local uploads',25)+text(245,790,'Email: Brevo / Resend / SMTP · Cloudflare Turnstile',25)
save('01-tech-stack','Tech stack','Ba ứng dụng trong cùng repository · Web và Mobile dùng chung backend',content,'Phiên bản theo package.json hiện tại; các dịch vụ ngoài phụ thuộc cấu hình môi trường.')

c=''
c+=rect(45,207,300,160)+text(69,248,'WEB APPLICATION',23,BLUE,600)+lines(69,289,['React · Vite','5 vai trò nghiệp vụ'],25,39)
c+=rect(45,410,300,160)+text(69,451,'MOBILE APPLICATION',23,BLUE,600)+lines(69,492,['React Native · Expo','Luồng Member & Coach'],25,39)
c+=arrow('M345 285 H430')+text(385,255,'REST',18,MUTED,400,'middle')
c+=arrow('M345 490 H430')+text(385,463,'REST',18,MUTED,400,'middle')
c+=text(55,618,'REST / JSON + Socket.IO',22,BLUE,600)
c+=rect(430,195,695,419,'#E8EEF9')+text(455,234,'BACKEND · MODULAR MONOLITH',25,BLUE,600)
c+=rect(455,253,645,61)+text(777,291,'Middleware: JWT · Role · Facility scope · Zod',23,INK,400,'middle')
c+=rect(455,330,645,59)+text(777,368,'Routes → Controllers → Services',26,INK,600,'middle')
c+=rect(455,404,645,111)+text(477,440,'Modules nghiệp vụ',23,TEAL,600)+lines(477,473,['Membership · Class / Schedule · Enrollment · Attendance','Payment / Invoice · Operations · Chat · Report · AI'],21,29)
c+=rect(455,531,645,59)+text(777,569,'Prisma / Mongoose · Socket.IO · Background jobs',23,INK,400,'middle')
c+=rect(1200,195,355,419)+text(1225,234,'DỊCH VỤ NGOÀI',23,TEAL,600)+lines(1225,282,['SePay / VietQR','Groq AI','Cloudinary','Brevo / Resend / SMTP','Cloudflare Turnstile'],24,55)
c+=arrow('M1125 390 H1200')+text(1162,366,'API',18,MUTED,400,'middle')
c+=arrow('M1200 580 H1125',True)+text(1164,546,'SePay',16,MUTED,400,'middle')+text(1164,565,'hook',16,MUTED,400,'middle')
c+=arrow('M597 614 V682')+arrow('M951 614 V682')
c+=rect(430,690,333,116)+text(455,728,'MONGODB',23,TEAL,600)+lines(455,761,['Identity · Profile','Refresh token'],22,28)
c+=rect(790,690,335,116)+text(815,728,'POSTGRESQL',23,BLUE,600)+lines(815,761,['Business data','Identity projections'],22,28)
c+=text(1200,668,'Local uploads trong backend',20,MUTED)+text(1200,701,'Jobs trong backend:',21,MUTED)+lines(1200,739,['Notification outbox','Subscription lifecycle'],22,35)
save('02-system-architecture','Kiến trúc tổng quan hệ thống','Kiến trúc logic theo code hiện tại · Client–Server · Một backend chia module',c,'MongoDB giữ định danh gốc; service đồng bộ bản chiếu sang PostgreSQL cho các quan hệ nghiệp vụ.')

roles={
 'Admin': ['Quản lý người dùng','Quản lý cơ sở & phân công','Quản lý danh mục gói tập','Quản lý bộ môn','Quản lý phòng tập & lớp học','Xem lịch hoạt động','Xử lý nghỉ phép & hỗ trợ','Xem tổng quan & nhật ký'],
 'Manager': ['Quản lý nhân sự cơ sở','Quản lý phòng tập','Quản lý lớp học','Điều phối lịch & huấn luyện viên','Quản lý chuyên cần','Xử lý nghỉ phép','Xử lý yêu cầu hỗ trợ','Xem báo cáo cơ sở'],
 'Receptionist': ['Quản lý hồ sơ hội viên','Đăng ký & gia hạn gói tập','Bán gói tại quầy','Hỗ trợ đăng ký lớp','Xem lịch lớp học','Theo dõi & hỗ trợ chuyên cần','Xử lý thanh toán & hóa đơn','Xử lý yêu cầu hỗ trợ'],
 'Coach': ['Xem lịch dạy','Xem lớp & học viên phụ trách','Điểm danh học viên','Tạo QR điểm danh','Gửi yêu cầu nghỉ phép','Xem đánh giá của hội viên'],
 'Member': ['Quản lý gói tập cá nhân','Đăng ký lớp & danh sách chờ','Xem lịch tập & lớp đã đăng ký','Điểm danh & check-in cơ sở','Thanh toán & xem hóa đơn','Đánh giá huấn luyện viên','Gửi yêu cầu hỗ trợ'],
 'Guest': ['Xem giới thiệu trung tâm','Đăng ký tài khoản','Đăng nhập / khôi phục mật khẩu','Hỏi trợ lý AI'],
}

def actor(x,y,name):
    return f'<g fill="none" stroke="{INK}" stroke-width="3.2"><circle cx="{x}" cy="{y-72}" r="20"/><path d="M{x} {y-52} V{y+12} M{x-35} {y-25} H{x+35} M{x} {y+12} L{x-30} {y+58} M{x} {y+12} L{x+30} {y+58}"/></g>'+text(x,y+98,name,25,INK,600,'middle')

def usecase_group(base,name,items):
    x=base+106; cy=444; bx=base+210; ex=base+466
    s=rect(bx,198,505,597,'white',LINE,8)+text(bx+22,232,'Sports Center Management System',19,MUTED)
    start=279 if len(items)>6 else 322
    step=65 if len(items)>6 else 76
    for i,label in enumerate(items):
        yy=start+i*step
        s+=f'<path d="M{x+39} {cy-20} L{ex-222} {yy}" fill="none" stroke="{LINE}" stroke-width="1.8"/>'
    s+=actor(x,cy,name)
    for i,label in enumerate(items):
        yy=start+i*step
        s+=f'<ellipse cx="{ex}" cy="{yy}" rx="222" ry="26" fill="#ECF2FE" stroke="#87A4DB" stroke-width="1.3"/>'+text(ex,yy+8,label,22,INK,400,'middle')
    return s

for name,title,pair,sub in [
    ('03-use-case-admin-manager','Use case · Quản trị & quản lý',('Admin','Manager'),'Admin: toàn hệ thống · Manager: trong phạm vi cơ sở được phân công'),
    ('04-use-case-receptionist-coach','Use case · Lễ tân & huấn luyện viên',('Receptionist','Coach'),'Lễ tân hỗ trợ vận hành tại quầy · Huấn luyện viên phụ trách buổi tập'),
    ('05-use-case-member-guest','Use case · Hội viên & khách',('Member','Guest'),'Member: tài khoản hội viên · Guest: người chưa đăng nhập, không phải role lưu trong database')]:
    c=usecase_group(20,pair[0],roles[pair[0]])+usecase_group(810,pair[1],roles[pair[1]])
    save(name,title,sub,c,'Các role đăng nhập còn có: quản lý hồ sơ cá nhân · chat · nhận thông báo · hỏi trợ lý AI.')

(OUT/'use-cases.json').write_text(json.dumps(roles,ensure_ascii=False,indent=2),encoding='utf-8')

# Editable Mermaid sources; use-case associations are deliberately undirected.
tech='''flowchart TB
  subgraph CLIENT[Client layer]
    FE[Web: React 19 / TypeScript / Vite 6<br/>React Router / TanStack Query / CSS / Fetch]
    MB[Mobile: React Native / Expo / TypeScript<br/>Expo Router / NativeWind / Axios / React Query]
  end
  FE --> API[Node.js / Express 5 / TypeScript<br/>JWT / Zod / Socket.IO]
  MB --> API
  API --> SQL[Prisma 5 / PostgreSQL]
  API --> NOSQL[Mongoose 9 / MongoDB]
  API --> EXT[SePay / VietQR / Groq AI<br/>Cloudinary / Email / Turnstile]
'''
arch='''flowchart TB
  W[Web application] -->|REST / JSON| R
  M[Mobile application] -->|REST / JSON| R
  W <-->|Socket.IO| RT
  M <-->|Socket.IO| RT
  subgraph BE[Backend: Modular Monolith]
    R[Middleware: JWT / Role / Facility scope / Zod] --> C[Routes / Controllers]
    C --> S[Domain Services]
    S --> P[Prisma / Mongoose]
    S --> RT[Socket.IO]
    J[In-process jobs: Outbox / Subscription lifecycle] --> S
    S --> SYNC[Identity projection synchronization]
  end
  P --> MG[(MongoDB: identity / profiles / refresh tokens)]
  P --> PG[(PostgreSQL: business data / identity projections)]
  SYNC --> PG
  S --> E[SePay / VietQR / Groq / Email / Cloudinary / Turnstile]
  E -. SePay webhook .-> R
'''
md='# Sơ đồ nguồn có thể chỉnh sửa\n\n## Tech stack\n\n```mermaid\n'+tech+'```\n\n## Architecture\n\n```mermaid\n'+arch+'```\n'
for n,items in roles.items():
    md+=f'\n## {n}\n\n```mermaid\nflowchart LR\n  A["{n}"]\n  subgraph SYS[Sports Center Management System]\n'
    md+=''.join(f'    U{i}(["{v}"])\n' for i,v in enumerate(items))
    md+='  end\n'+''.join(f'  A --- U{i}\n' for i in range(len(items)))+'```\n'
(OUT/'diagrams.md').write_text(md,encoding='utf-8')
print('Generated 5 SVG diagrams, Mermaid sources, and use-case data.')
