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

## Truy cập trực tiếp bằng IP

Mặc định Docker publish ứng dụng tại `0.0.0.0:2000`, nên có thể kiểm tra bằng `http://IP_VPS:2000` sau khi mở firewall. Cấu hình bằng `HOST_PORT` và `BIND_ADDRESS`.

Khi đã dùng Nginx, đặt `BIND_ADDRESS=127.0.0.1` để không public trực tiếp cổng ứng dụng.

## Cập nhật thời gian thực

Realtime được bật mặc định bằng `REALTIME_ENABLED=true`. Kiến trúc sử dụng MongoDB event store (TTL 24 giờ), Redis Pub/Sub giữa nhiều container và SSE từ `/api/realtime/events` tới trình duyệt.

Các event hiện có: task create/update/delete/status/comment/checklist, project update/member, user update, operations và notification failure. Server lọc event theo project membership; admin nhận event toàn hệ thống. Refresh session nằm trong cookie HttpOnly, không truyền token trên URL.

Frontend dùng TanStack Query. Task board cập nhật optimistic và rollback khi API lỗi; SSE invalidate cache liên quan. Nếu realtime tắt hoặc gián đoạn, task/dashboard vẫn polling mỗi 60 giây.

### Cấu hình

```env
REALTIME_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
```

Redis không bắt buộc khi chỉ chạy một instance. Khi Redis lỗi, event trong instance hiện tại vẫn hoạt động qua local event bus và Winston ghi cảnh báo.

### Nginx

Dùng mẫu `deploy/nginx-realtime.conf.example`. Bắt buộc tắt `proxy_buffering`, đặt `X-Accel-Buffering: no` và tăng `proxy_read_timeout` cho endpoint SSE.

### Kiểm tra SSE

Lấy cookie `igen_refresh` từ một session thử nghiệm rồi chạy:

```bash
COOKIE='igen_refresh=<token>' BASE_URL=https://example.com npm run test:realtime
```

Có thể đặt `CONNECTIONS` và `DURATION_MS`. Mỗi user bị giới hạn tối đa 5 kết nối SSE đồng thời; load test lớn cần nhiều session người dùng.

### Rollout

1. Deploy với `REALTIME_ENABLED=false` để xác nhận polling và schema/index.
2. Khởi động Redis, bật realtime trên một môi trường/instance.
3. Kiểm tra Operations: active connections, Redis state và publish failures.
4. Bật toàn bộ instance; giữ polling 60 giây làm fallback.
5. Khi rollback, đặt `REALTIME_ENABLED=false`; API nghiệp vụ không bị ảnh hưởng.
