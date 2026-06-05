# NOM CURRY - Hệ Thống Quản Lý Ca Làm, Điểm Danh & Tính Lương

Hệ thống quản lý ca làm việc, điểm danh check-in/check-out và tổng hợp bảng tính lương tự động cho nhân viên cửa hàng, tích hợp trực tiếp với Google Sheets và xác thực bảo mật bằng Google OAuth.

---

## 🚀 Các Tính Năng Chính

* **Tổng quan (Dashboard)**: Theo dõi số liệu đăng ký ca, ca chờ duyệt, tổng giờ làm việc và dự toán chi phí lương của cửa hàng.
* **Đăng ký ca làm**: Nhân viên tự đăng ký ca làm linh hoạt theo tuần, hỗ trợ giao diện responsive hiển thị mượt mà trên thiết bị di động.
* **Duyệt ca làm**: Quản lý duyệt ca đăng ký nhanh chóng theo ngày hoặc duyệt nhanh cả tuần chỉ với một lần nhấn.
* **Điểm danh (Attendance)**: Check-in và Check-out trực quan ngay khi bắt đầu và kết thúc ca làm việc.
* **Bảng lương (Payroll)**: Quản lý lương tự động, lọc tổng giờ và tổng lương nhân viên theo tháng, cập nhật hệ số lương trực tiếp vào Google Sheets.

---

## 🛠️ Công Nghệ Sử Dụng

* **Core**: Next.js 15 (App Router), React 19, TypeScript
* **Styling**: Tailwind CSS v4, Base UI, Lucide Icons, Sonner (Toasts)
* **Database**: Google Sheets API thông qua tài khoản dịch vụ (`googleapis`)
* **Security & Auth**: Google OAuth sử dụng **Auth.js** (NextAuth v5) với cơ chế ký mã hóa JWT an toàn.

---

## 💻 Hướng Dẫn Cài Đặt

### 1. Cài đặt các gói phụ thuộc
Chạy lệnh sau tại thư mục gốc:
```bash
npm install
```

### 2. Thiết lập biến môi trường
Sao chép file `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Điền đầy đủ thông tin cấu hình vào file `.env`:

* **GOOGLE_SERVICE_ACCOUNT_EMAIL** & **GOOGLE_PRIVATE_KEY**: Lấy từ tệp JSON Khóa tài khoản dịch vụ (Service Account) trên Google Cloud Console.
* **GOOGLE_SPREADSHEET_ID**: ID của file Google Sheet của bạn (lấy từ đường dẫn URL của sheet).
* **NOMCURRY_DEV_ACTOR_EMAIL**: Email giả định để chạy thử nhanh trên localhost (chỉ có tác dụng trong môi trường phát triển).
* **AUTH_GOOGLE_ID** & **AUTH_GOOGLE_SECRET**: Client ID và Secret của ứng dụng OAuth lấy từ Google Cloud Console.
* **AUTH_SECRET**: Khóa mã hóa session tự tạo (sử dụng lệnh `openssl rand -base64 32`).

### 3. Cấp quyền trên Google Sheet
Mở file Google Sheet của bạn ra, nhấn **Chia sẻ (Share)** và thêm địa chỉ **GOOGLE_SERVICE_ACCOUNT_EMAIL** với quyền **Editor** để ứng dụng có quyền đọc/ghi.

### 4. Chạy chế độ phát triển
Khởi động dev server:
```bash
npm run dev
```
Mở [http://localhost:3000](http://localhost:3000) trên trình duyệt của bạn.

---

## 📦 Deploy lên Vercel
Khi deploy lên Vercel, hãy đảm bảo bạn cấu hình đầy đủ các biến môi trường tương tự như file `.env` trên trang thiết lập dự án của Vercel. Cơ chế Dev Fallback sẽ tự động bị vô hiệu hóa trên production để ép người dùng phải đăng nhập bằng tài khoản Google thực tế của họ.
