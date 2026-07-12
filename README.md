# GitHub PR Review Task Platform

M?t service Node.js/TypeScript ph?c v? d?ng th?i REST API backend v� React frontend. D? li?u d�ng MongoDB, x�c th?c JWT v� ph�n quy?n theo role.

## C?u tr�c

```text
backend/src/
  config/                 Bi?n m�i tru?ng
  core/                   MongoDB, JWT, authorization
  modules/
    auth/                 Login v� JWT routes
    users/                Bootstrap superadmin, user service
    tasks/                Model, service, controller, router
frontend/src/
  api/                    API client
  components/             Component t�i s? d?ng
  features/               Feature auth, tasks
  hooks/                  Custom hooks
  types/                  TypeScript domain types
  styles/                 Product styles
```

## C�i d?t

```bash
npm install
cp .env.example .env
npm run dev
```

C�c bi?n b?t bu?c:

```env
MONGODB_URI=mongodb://mongodb:27017/igen-erp
JWT_SECRET=<long-random-secret>
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=<strong-password>
```

Lần khởi động đầu tiên tạo một user `superadmin` nếu collection `users` đang trống. Đăng nhập từ frontend bằng email/password này.

## Xác thực (Auth)

- Đăng nhập qua `POST /api/auth/login`. Server ký JWT và trả về bằng **httpOnly cookie** (`token`), không trả token trong response body — trình duyệt tự đính kèm cookie ở các request sau (`credentials: "include"`), phía frontend không lưu token trong `localStorage`.
- Cookie có `sameSite=lax`, `secure=true` khi `NODE_ENV=production`, và hết hạn sau 8 giờ.
- Mỗi JWT có một `jti` (session id) riêng. `POST /api/auth/logout` sẽ revoke `jti` đó (lưu vào collection `revoked_tokens` với TTL index) và xoá cookie — token cũ dùng lại sẽ bị từ chối dù chưa hết hạn.
- Các request thay đổi state (`POST`/`PUT`/`DELETE`) tới `/api/*` được kiểm tra `Origin` header (chặn cross-origin) như một lớp phòng thủ CSRF bổ sung cho cookie `sameSite=lax`.
- Đăng nhập bị giới hạn tốc độ: tối đa 10 lần/phút cho mỗi IP; vượt quá sẽ nhận `429 Too many requests`.
- Nếu gọi API trực tiếp (không qua trình duyệt), vẫn có thể dùng header `Authorization: Bearer <token>` thay cho cookie.

## Roles

| Role | Quy?n |
| --- | --- |
| `superadmin` | To�n quy?n, t?o user |
| `admin` | Qu?n l� task v� user |
| `manager` | T?o/s?a task |
| `developer` | Xem task, d?i tr?ng th�i, b�nh lu?n |

## L?nh

```bash
npm run dev
npm run dev:frontend
npm run build
npm start
npm run lint
npm run typecheck
npm test
```

`npm run build` build React v�o `frontend/dist`, TypeScript backend v�o `dist/backend`; Express ph?c v? c? frontend v� API trong c�ng container/service.

## Docker

```bash
docker compose up -d --build
```

Container webhook ph?i truy c?p du?c MongoDB qua hostname/network ph� h?p; kh�ng d�ng `localhost` cho MongoDB n?m ngo�i container.
