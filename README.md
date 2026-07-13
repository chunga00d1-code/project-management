# PR Review Task Platform

Nền tảng quản lý task tích hợp GitHub Pull Request, gồm Express/TypeScript, React và MongoDB. Hệ thống nhận webhook GitHub, tạo/cập nhật task, rà soát diff, gửi thông báo và cung cấp bảng quản trị vận hành.

## Chạy local

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

Yêu cầu Node.js 20+ và MongoDB. Thiết lập `MONGODB_URI`, `JWT_SECRET`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` trong `.env`.

## Kiểm tra chất lượng

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Quyền

| Role | Quyền |
| --- | --- |
| superadmin | Toàn quyền |
| admin | Quản trị task, user, settings, operations |
| manager | Tạo/sửa/xóa task |
| developer | Xem task, đổi trạng thái, bình luận |

Developer chỉ có thể gọi `PATCH /api/tasks/:id/status`; không thể sửa metadata hoặc xóa task.

## API chính

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/tasks`, `PATCH /api/tasks/:id`, `PATCH /api/tasks/:id/status`
- `GET /api/tasks/search?q=&priority=&project=&assignee=&page=&limit=`
- `GET /api/tasks/dashboard`
- `GET/PUT /api/settings` (admin)
- `GET /api/operations/audit`, `GET /api/operations/dead-letter`
- `POST /api/operations/dead-letter/:id/retry`
- `POST /webhooks/github`

Task hỗ trợ `project`, `sprint`, `team`, assignee, priority, due date, label và liên kết PR.

## Vận hành

```bash
docker compose up -d --build
```

Kiểm tra `GET /health` và `GET /ready`. MongoDB tự tạo index cho user, PR task, webhook delivery, retry queue, dead-letter queue và audit log lúc khởi động.

Webhook GitHub cần cấu hình HMAC secret. Nên giới hạn `ALLOWED_REPOSITORIES`, dùng token GitHub tối thiểu quyền và lưu secret bằng cơ chế secret manager của môi trường triển khai.

Job thông báo retry theo exponential backoff, tối đa 8 lần. Job thất bại cuối cùng nằm trong dead-letter queue và có thể retry lại trên giao diện Operations.

## Logging

Ứng dụng dùng Winston và xuất structured JSON ra stdout. Mỗi HTTP request có `x-request-id`, method, path, status, duration, IP và user-agent. Lỗi request trả lại `requestId` để đối chiếu log.

- `LOG_LEVEL`: `error`, `warn`, `info`, `http`, `verbose`, `debug` hoặc `silly`.
- `LOG_FILE`: bỏ trống để chỉ ghi stdout; đặt đường dẫn để ghi thêm file xoay vòng.
- `LOG_MAX_SIZE`: kích thước tối đa mỗi file, mặc định 10 MB.
- `LOG_MAX_FILES`: số file giữ lại, mặc định 5.

Không nên ghi log file trong container nếu chưa mount volume; stdout phù hợp hơn cho Docker logging driver.
