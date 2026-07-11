# GitHub PR Review Task Platform

M?t service Node.js/TypeScript ph?c v? d?ng th?i REST API backend và React frontend. D? li?u dùng MongoDB, xác th?c JWT và phân quy?n theo role.

## C?u trúc

```text
backend/src/
  config/                 Bi?n môi tru?ng
  core/                   MongoDB, JWT, authorization
  modules/
    auth/                 Login và JWT routes
    users/                Bootstrap superadmin, user service
    tasks/                Model, service, controller, router
frontend/src/
  api/                    API client
  components/             Component tái s? d?ng
  features/               Feature auth, tasks
  hooks/                  Custom hooks
  types/                  TypeScript domain types
  styles/                 Product styles
```

## Cài d?t

```bash
npm install
cp .env.example .env
npm run dev
```

Các bi?n b?t bu?c:

```env
MONGODB_URI=mongodb://mongodb:27017/igen-erp
JWT_SECRET=<long-random-secret>
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=<strong-password>
```

L?n kh?i d?ng d?u tiên t?o m?t user `superadmin` n?u collection `users` dang tr?ng. Ðang nh?p t? frontend b?ng email/password này d? nh?n JWT.

## Roles

| Role | Quy?n |
| --- | --- |
| `superadmin` | Toàn quy?n, t?o user |
| `admin` | Qu?n lý task và user |
| `manager` | T?o/s?a task |
| `developer` | Xem task, d?i tr?ng thái, bình lu?n |

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

`npm run build` build React vào `frontend/dist`, TypeScript backend vào `dist/backend`; Express ph?c v? c? frontend và API trong cùng container/service.

## Docker

```bash
docker compose up -d --build
```

Container webhook ph?i truy c?p du?c MongoDB qua hostname/network phù h?p; không dùng `localhost` cho MongoDB n?m ngoài container.
