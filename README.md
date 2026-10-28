# Sân Nhà

Website tiếng Việt theo dõi lịch thi đấu, tỷ số, bảng xếp hạng và tin bóng đá của sáu giải: Premier League, La Liga, Bundesliga, Serie A, Ligue 1 và UEFA Champions League.

## Kiến trúc

- `web/`: React + TypeScript + Vite, triển khai trên Vercel.
- `src/`: NestJS API, triển khai trên Render.
- Supabase Postgres: dữ liệu thi đấu đã đồng bộ và bài viết.
- football-data.org v4: nguồn dữ liệu bóng đá duy nhất; chỉ API backend giữ token.

Ứng dụng không có đăng ký độc giả, bình luận, chuyển nhượng hoặc tài khoản người dùng công khai. Các endpoint CMS yêu cầu Supabase access token và kiểm tra email quản trị viên ở backend.

## Biến môi trường

### NestJS API

| Biến                      | Mô tả                                                                     |
| ------------------------- | ------------------------------------------------------------------------- |
| `PORT`                    | Cổng do Render cấp.                                                       |
| `HTTP_HOST`               | Đặt `0.0.0.0` trên Render.                                                |
| `APP_ENV`                 | `production`.                                                             |
| `APP_CORS_ORIGINS`        | Origin chính xác của frontend Vercel.                                     |
| `DATABASE_URL`            | Kết nối PostgreSQL Supabase qua pooler hoặc direct connection.            |
| `DATABASE_PASSWORD`       | Mật khẩu Postgres riêng; API mã hóa cho URI nội bộ khi mở kết nối.        |
| `FOOTBALL_DATA_API_TOKEN` | Secret football-data.org; chỉ cấu hình trên Render.                       |
| `SUPABASE_URL`            | URL project Supabase.                                                     |
| `SUPABASE_ANON_KEY`       | Publishable key dùng để xác minh phiên Auth; không phải service-role key. |
| `ADMIN_EMAIL`             | Email quản trị duy nhất (`topinfo93@gmail.com`).                          |

### Frontend Vercel

| Biến                     | Mô tả                                 |
| ------------------------ | ------------------------------------- |
| `VITE_API_BASE_URL`      | URL HTTPS của NestJS API trên Render. |
| `VITE_SUPABASE_URL`      | URL project Supabase.                 |
| `VITE_SUPABASE_ANON_KEY` | Publishable key của Supabase Auth.    |

Không đưa database password, service-role key hay football-data token vào biến `VITE_*`.

## Cài đặt và chạy local

### Chạy demo local không cần dịch vụ ngoài

Backend đặt `APP_ENV=local` và `LOCAL_DEMO_MODE=true` trong `.env`. Khi bật chế độ này, API dùng dữ liệu mẫu cho bóng đá, lưu bài viết CMS trong bộ nhớ và không cần `DATABASE_URL`, football-data.org token hoặc Supabase. Mật khẩu admin local lấy từ `LOCAL_ADMIN_PASSWORD` (mặc định trong env mẫu là `san-nha-local-demo`). Frontend đặt `VITE_LOCAL_DEMO_MODE=true` và `VITE_API_BASE_URL=http://localhost:3000` trong `web/.env`.

```bash
# Terminal 1: API (repo root)
npm ci
npm run dev

# Terminal 2: frontend
cd web
npm ci
npm run dev
```

CMS demo chỉ xác thực local và dữ liệu tạo/sửa/xóa sẽ mất khi API khởi động lại. Không bật `LOCAL_DEMO_MODE` trong production; chế độ giả chỉ hoạt động khi `APP_ENV=local`.

### Chạy với dịch vụ đã cấu hình

```bash
# API
npm ci
npx prisma generate
npm run build
npm run dev

# Frontend
cd web
npm ci
npm run dev
```

Tạo `.env` từ `.env.example` rồi điền các biến cần thiết. Không commit `.env`.

## Cơ sở dữ liệu

Schema nằm trong `supabase/migrations/`. Các bảng đều bật RLS và không cấp quyền truy cập trực tiếp cho vai trò `anon`/`authenticated`; dữ liệu chỉ được NestJS truy cập bằng kết nối máy chủ. Schema được tạo trong project Supabase riêng dành cho Sân Nhà. Khi cập nhật schema, tạo và áp dụng migration Supabase mới; không chạy `prisma migrate deploy` trên project này.

Tạo tài khoản quản trị duy nhất `topinfo93@gmail.com` trong Supabase Auth Dashboard trước khi dùng CMS. Không bật giao diện đăng ký độc giả.

## Cập nhật dữ liệu

API đồng bộ theo yêu cầu, có khóa chống gọi trùng và giới hạn khoảng cách request để tôn trọng quota miễn phí. Dữ liệu lỗi hoặc giải không nằm trong coverage được lưu thành trạng thái sync để giao diện thông báo; ứng dụng không sinh tỷ số hay bảng xếp hạng giả. Render Free có thể sleep khi không có lượt truy cập, nên không cam kết cập nhật trực tiếp.
